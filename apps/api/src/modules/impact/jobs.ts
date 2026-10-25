import type { JobProcessor } from '../../lib/module';
import { sql } from '@lore/db';
import { getDb } from '../../lib/db';
import { syncImpact } from './service';

export async function refreshEngagementTopics() {
  await getDb().execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY engagement_topics_1d`);
  return { refreshed: true };
}

/** impact BullMQ processors [C2]. Job names are `impact.<job>`. */
export const jobs: Record<string, JobProcessor> = {
  'impact.sync': async () => syncImpact(),
  'impact.refresh-topics': async () => refreshEngagementTopics(),
};
