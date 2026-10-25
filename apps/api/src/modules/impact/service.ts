import { zImpactSummaryDTO, type ImpactSummaryDTO } from '@lore/shared/dto/impact';
import { getRedis } from '../../lib/redis';
import { sanitizeImpactEvent } from './policy';
import { ImpactRepository, impactRepository } from './repository';
import { SnowflakeClient, snowflakeClient } from './snowflake';
import type { ImpactEventInput, ImpactEventRow, SyncCursor } from './types';

const CURSOR = 'snowflake-impact';
const CACHE_KEY = 'impact:summary:v1';
type Cache = {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
};
type ImpactStore = Pick<ImpactRepository, 'record' | 'cursor' | 'batchAfter' | 'advance' | 'recent'>;

export type ImpactDependencies = {
  store: ImpactStore;
  snowflake: Pick<SnowflakeClient, 'configured' | 'insert' | 'aggregateSummary' | 'pulse'>;
  cache: () => Cache;
  now: () => Date;
  salt: string;
};

function ratio(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 10_000) / 100 : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

export function aggregateLocal(events: ImpactEventRow[], updatedAt: Date): ImpactSummaryDTO {
  const groups = new Set(events.map((event) => event.groupHash).filter(Boolean));
  const byObject = new Map<string, ImpactEventRow[]>();
  for (const event of events) {
    const objectHash = typeof event.props.objectHash === 'string' ? event.props.objectHash : null;
    if (objectHash) byObject.set(objectHash, [...(byObject.get(objectHash) ?? []), event]);
  }
  const confirmed = events.filter((event) => event.kind === 'plan_confirmed').length;
  const suggestionsWithVotes = [...byObject.values()].filter(
    (rows) =>
      new Set(rows.filter((row) => row.kind === 'plan_vote_cast').map((row) => row.actorHash)).size >= 2,
  ).length;
  const recapReady = new Set(
    events.filter((event) => event.kind === 'recap_ready').map((event) => event.props.objectHash),
  ).size;
  const recapPosted = new Set(
    events.filter((event) => event.kind === 'recap_posted').map((event) => event.props.objectHash),
  ).size;
  const requested = events.filter((event) => event.kind === 'intro_requested').length;
  const accepted = events.filter((event) => event.kind === 'intro_accepted').length;
  const aiInteractions = events.filter((event) => event.kind === 'ai_interaction').length;
  const aiMutes = events.filter((event) => event.kind === 'ai_muted').length;
  const confirmationMinutes = [...byObject.values()].flatMap((rows) => {
    const suggested = rows.find((row) => row.kind === 'plan_suggested')?.at;
    const confirmedAt = rows.find((row) => row.kind === 'plan_confirmed')?.at;
    return suggested && confirmedAt ? [(confirmedAt.getTime() - suggested.getTime()) / 60_000] : [];
  });
  const daily = new Map<string, { plans: number; intros: number }>();
  for (const event of events) {
    const day = event.at.toISOString().slice(0, 10);
    const value = daily.get(day) ?? { plans: 0, intros: 0 };
    if (event.kind === 'plan_confirmed') value.plans += 1;
    if (event.kind === 'intro_accepted') value.intros += 1;
    daily.set(day, value);
  }
  const days = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  return {
    metrics: [
      {
        key: 'confirmed_per_active_group',
        label: 'Confirmed plans / active group',
        value: groups.size ? confirmed / groups.size : 0,
        unit: 'plans',
      },
      {
        key: 'suggestions_two_votes',
        label: 'Suggestions with 2+ votes',
        value: suggestionsWithVotes,
        unit: null,
      },
      {
        key: 'recap_conversion',
        label: 'Recap-to-post conversion',
        value: ratio(recapPosted, recapReady),
        unit: '%',
      },
      { key: 'intro_acceptance', label: 'Intro acceptance', value: ratio(accepted, requested), unit: '%' },
      { key: 'ai_mute_rate', label: 'AI mute rate', value: ratio(aiMutes, aiInteractions), unit: '%' },
      {
        key: 'median_confirm_minutes',
        label: 'Median intent-to-confirm',
        value: Math.round(median(confirmationMinutes) * 10) / 10,
        unit: 'min',
      },
    ],
    series: [
      { key: 'plans', label: 'Plans confirmed', points: days.map(([t, value]) => ({ t, v: value.plans })) },
      {
        key: 'intros',
        label: 'Introductions accepted',
        points: days.map(([t, value]) => ({ t, v: value.intros })),
      },
    ],
    pulse: null,
    updatedAt: updatedAt.toISOString(),
    source: 'mock',
  };
}

export class ImpactService {
  constructor(private readonly deps: ImpactDependencies) {}

  async record(input: ImpactEventInput) {
    const clean = sanitizeImpactEvent(input, this.deps.salt);
    return this.deps.store.record(clean);
  }

  async sync() {
    if (!this.deps.snowflake.configured) return { synced: 0, configured: false };
    const cursor = await this.deps.store.cursor(CURSOR);
    const rows = await this.deps.store.batchAfter(cursor, 500);
    if (!rows.length) return { synced: 0, configured: true };
    await this.deps.snowflake.insert(rows);
    const last = rows.at(-1)!;
    await this.deps.store.advance(CURSOR, { lastAt: last.at, lastEventId: last.eventId });
    return { synced: rows.length, configured: true };
  }

  private async cached(): Promise<ImpactSummaryDTO | null> {
    const raw = await this.deps
      .cache()
      .get(CACHE_KEY)
      .catch(() => null);
    if (!raw) return null;
    const parsed = zImpactSummaryDTO.safeParse(JSON.parse(raw));
    return parsed.success ? { ...parsed.data, source: 'cache' } : null;
  }

  async summary(): Promise<ImpactSummaryDTO> {
    if (this.deps.snowflake.configured) {
      try {
        const aggregate = await this.deps.snowflake.aggregateSummary();
        const pulse = await this.deps.snowflake.pulse(aggregate.metrics).catch(() => null);
        const value: ImpactSummaryDTO = {
          ...aggregate,
          pulse,
          updatedAt: this.deps.now().toISOString(),
          source: 'snowflake',
        };
        await this.deps
          .cache()
          .setex(CACHE_KEY, 900, JSON.stringify(value))
          .catch(() => undefined);
        return value;
      } catch {
        const cached = await this.cached();
        if (cached) return cached;
      }
    } else {
      const cached = await this.cached();
      if (cached) return cached;
    }
    const events = await this.deps.store.recent(new Date(this.deps.now().getTime() - 90 * 86_400_000));
    const local = aggregateLocal(events, this.deps.now());
    await this.deps
      .cache()
      .setex(CACHE_KEY, 60, JSON.stringify(local))
      .catch(() => undefined);
    return local;
  }
}

const impactService = new ImpactService({
  store: impactRepository,
  snowflake: snowflakeClient,
  cache: getRedis,
  now: () => new Date(),
  salt: process.env.ANALYTICS_HASH_SALT ?? process.env.BETTER_AUTH_SECRET ?? 'lore-local-analytics',
});

export const recordImpactEvent = (input: ImpactEventInput) => impactService.record(input);
export const syncImpact = () => impactService.sync();
export const getImpactSummary = () => impactService.summary();
export type { ImpactEventInput, SyncCursor };
