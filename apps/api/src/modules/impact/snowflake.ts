import { createHash } from 'node:crypto';
import type { ImpactSummaryDTO } from '@lore/shared/dto/impact';
import type { ImpactEventRow } from './types';

type SnowflakeConfig = {
  account?: string;
  pat?: string;
  role?: string;
  warehouse?: string;
  database?: string;
  cortexModel?: string;
};

type StatementResult = {
  statementHandle?: string;
  data?: unknown[][];
  resultSetMetaData?: { rowType?: { name: string }[] };
  message?: string;
};

const TABLE_SQL = `CREATE TABLE IF NOT EXISTS IMPACT_EVENTS (
  event_id STRING NOT NULL, at TIMESTAMP_TZ NOT NULL, kind STRING NOT NULL,
  group_hash STRING, actor_hash STRING, props VARIANT
)`;

export const IMPACT_VIEW_SQL = [
  `CREATE OR REPLACE SECURE VIEW V_CONFIRMED_PLANS_PER_ACTIVE_GROUP AS
   SELECT DIV0(COUNT_IF(kind = 'plan_confirmed'), COUNT(DISTINCT group_hash))::FLOAT AS value
   FROM IMPACT_EVENTS WHERE at >= DATEADD(day, -30, CURRENT_TIMESTAMP())`,
  `CREATE OR REPLACE SECURE VIEW V_SUGGESTIONS_TWO_PLUS_VOTES AS
   SELECT COUNT_IF(votes >= 2)::FLOAT AS value FROM (
     SELECT props:objectHash::STRING AS object_hash, COUNT(DISTINCT actor_hash) AS votes
     FROM IMPACT_EVENTS WHERE kind = 'plan_vote_cast' GROUP BY 1
   )`,
  `CREATE OR REPLACE SECURE VIEW V_RECAP_TO_POST_CONVERSION AS
   SELECT DIV0(COUNT(DISTINCT IFF(kind = 'recap_posted', props:objectHash::STRING, NULL)),
               COUNT(DISTINCT IFF(kind = 'recap_ready', props:objectHash::STRING, NULL))) * 100::FLOAT AS value
   FROM IMPACT_EVENTS`,
  `CREATE OR REPLACE SECURE VIEW V_INTRO_ACCEPTANCE AS
   SELECT DIV0(COUNT_IF(kind = 'intro_accepted'), COUNT_IF(kind = 'intro_requested')) * 100::FLOAT AS value
   FROM IMPACT_EVENTS`,
  `CREATE OR REPLACE SECURE VIEW V_AI_MUTE_RATE AS
   SELECT DIV0(COUNT_IF(kind = 'ai_muted'), COUNT_IF(kind = 'ai_interaction')) * 100::FLOAT AS value
   FROM IMPACT_EVENTS`,
  `CREATE OR REPLACE SECURE VIEW V_MEDIAN_INTENT_TO_CONFIRM AS
   SELECT MEDIAN(DATEDIFF('second', suggested_at, confirmed_at)) / 60::FLOAT AS value FROM (
     SELECT props:objectHash::STRING AS object_hash,
       MIN(IFF(kind = 'plan_suggested', at, NULL)) AS suggested_at,
       MIN(IFF(kind = 'plan_confirmed', at, NULL)) AS confirmed_at
     FROM IMPACT_EVENTS WHERE kind IN ('plan_suggested', 'plan_confirmed') GROUP BY 1
   ) WHERE suggested_at IS NOT NULL AND confirmed_at IS NOT NULL`,
] as const;

const METRICS_SQL = `
SELECT 'confirmed_per_active_group', 'Confirmed plans / active group', value, 'plans' FROM V_CONFIRMED_PLANS_PER_ACTIVE_GROUP
UNION ALL SELECT 'suggestions_two_votes', 'Suggestions with 2+ votes', value, NULL FROM V_SUGGESTIONS_TWO_PLUS_VOTES
UNION ALL SELECT 'recap_conversion', 'Recap-to-post conversion', value, '%' FROM V_RECAP_TO_POST_CONVERSION
UNION ALL SELECT 'intro_acceptance', 'Intro acceptance', value, '%' FROM V_INTRO_ACCEPTANCE
UNION ALL SELECT 'ai_mute_rate', 'AI mute rate', value, '%' FROM V_AI_MUTE_RATE
UNION ALL SELECT 'median_confirm_minutes', 'Median intent-to-confirm', value, 'min' FROM V_MEDIAN_INTENT_TO_CONFIRM`;

const SERIES_SQL = `SELECT TO_VARCHAR(DATE_TRUNC('day', at), 'YYYY-MM-DD') AS day,
  COUNT_IF(kind = 'plan_confirmed') AS plans, COUNT_IF(kind = 'intro_accepted') AS intros
  FROM IMPACT_EVENTS WHERE at >= DATEADD(day, -13, CURRENT_TIMESTAMP()) GROUP BY 1 ORDER BY 1`;

function defaultConfig(): SnowflakeConfig {
  return {
    account: process.env.SNOWFLAKE_ACCOUNT,
    pat: process.env.SNOWFLAKE_PAT,
    role: process.env.SNOWFLAKE_ROLE,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? 'LORE_WH',
    database: process.env.SNOWFLAKE_DATABASE ?? 'LORE',
    cortexModel: process.env.SNOWFLAKE_CORTEX_MODEL,
  };
}

export class SnowflakeClient {
  private bootstrapped = false;
  constructor(
    private readonly config: SnowflakeConfig = defaultConfig(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  get configured() {
    return Boolean(this.config.account && this.config.pat);
  }

  private baseUrl() {
    const account = this.config.account!;
    return account.startsWith('http')
      ? account.replace(/\/$/, '')
      : `https://${account}.snowflakecomputing.com`;
  }

  private async statement(sqlText: string, bindings: Record<string, unknown> = {}, requestId?: string) {
    const id = requestId ?? createHash('sha256').update(sqlText).digest('hex').slice(0, 32);
    const body = {
      statement: sqlText,
      timeout: 45,
      database: this.config.database,
      schema: 'PUBLIC',
      warehouse: this.config.warehouse,
      role: this.config.role,
      bindings,
    };
    let response: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await this.fetcher(`${this.baseUrl()}/api/v2/statements?requestId=${id}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.pat}`,
          'content-type': 'application/json',
          'x-snowflake-authorization-token-type': 'PROGRAMMATIC_ACCESS_TOKEN',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) break;
      if (response.status !== 429 && response.status < 500)
        throw new Error(`Snowflake SQL failed: ${response.status}`);
      if (attempt === 3) throw new Error(`Snowflake SQL retries exhausted: ${response.status}`);
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
    let result = (await response!.json()) as StatementResult;
    for (let poll = 0; response!.status === 202 && result.statementHandle && poll < 8; poll += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      response = await this.fetcher(`${this.baseUrl()}/api/v2/statements/${result.statementHandle}`, {
        headers: {
          authorization: `Bearer ${this.config.pat}`,
          'x-snowflake-authorization-token-type': 'PROGRAMMATIC_ACCESS_TOKEN',
        },
        signal: AbortSignal.timeout(15_000),
      });
      result = (await response.json()) as StatementResult;
    }
    if (!response!.ok || response!.status === 202)
      throw new Error(result.message ?? 'Snowflake statement did not complete');
    return result;
  }

  private async bootstrap() {
    if (this.bootstrapped) return;
    await this.statement(TABLE_SQL);
    for (const sql of IMPACT_VIEW_SQL) await this.statement(sql);
    this.bootstrapped = true;
  }

  async insert(events: ImpactEventRow[]) {
    if (!this.configured || !events.length) return;
    await this.bootstrap();
    const rows = events.map((event) => ({
      event_id: event.eventId,
      at: event.at.toISOString(),
      kind: event.kind,
      group_hash: event.groupHash,
      actor_hash: event.actorHash,
      props: event.props,
    }));
    const payload = JSON.stringify(rows);
    const requestId = createHash('sha256').update(payload).digest('hex').slice(0, 32);
    await this.statement(
      `MERGE INTO IMPACT_EVENTS target USING (
        SELECT value:event_id::STRING event_id, value:at::TIMESTAMP_TZ at, value:kind::STRING kind,
          value:group_hash::STRING group_hash, value:actor_hash::STRING actor_hash, value:props::VARIANT props
        FROM TABLE(FLATTEN(INPUT => PARSE_JSON(?)))
      ) source ON target.event_id = source.event_id
      WHEN NOT MATCHED THEN INSERT (event_id, at, kind, group_hash, actor_hash, props)
      VALUES (source.event_id, source.at, source.kind, source.group_hash, source.actor_hash, source.props)`,
      { 1: { type: 'TEXT', value: payload } },
      requestId,
    );
  }

  async aggregateSummary(): Promise<Pick<ImpactSummaryDTO, 'metrics' | 'series'>> {
    await this.bootstrap();
    const [metricsResult, seriesResult] = await Promise.all([
      this.statement(METRICS_SQL),
      this.statement(SERIES_SQL),
    ]);
    const metrics = (metricsResult.data ?? []).map((row) => ({
      key: String(row[0]),
      label: String(row[1]),
      value: Number(row[2] ?? 0),
      unit: row[3] == null ? null : String(row[3]),
    }));
    const days = (seriesResult.data ?? []).map((row) => ({
      t: String(row[0]),
      plans: Number(row[1] ?? 0),
      intros: Number(row[2] ?? 0),
    }));
    return {
      metrics,
      series: [
        { key: 'plans', label: 'Plans confirmed', points: days.map(({ t, plans }) => ({ t, v: plans })) },
        {
          key: 'intros',
          label: 'Introductions accepted',
          points: days.map(({ t, intros }) => ({ t, v: intros })),
        },
      ],
    };
  }

  async pulse(metrics: ImpactSummaryDTO['metrics']): Promise<string | null> {
    if (!this.config.cortexModel) return null;
    const prompt = `Write exactly three short sentences about these aggregate community metrics. No people, groups, identifiers, or unsupported causes: ${JSON.stringify(metrics.map(({ key, value, unit }) => ({ key, value, unit })))}`;
    const result = await this.statement('SELECT SNOWFLAKE.CORTEX.COMPLETE(?, ?)', {
      1: { type: 'TEXT', value: this.config.cortexModel },
      2: { type: 'TEXT', value: prompt },
    });
    const text = String(result.data?.[0]?.[0] ?? '').trim();
    return text ? text.slice(0, 700) : null;
  }
}

export const snowflakeClient = new SnowflakeClient();
