import { createHash } from 'node:crypto';
import { candidates, createDb } from '../packages/db/src/index';
import { uuidv7 } from '../packages/shared/src/ids';
import { seedTarget } from './seed-safety';

if (!process.argv.includes('--confirm-live')) {
  throw new Error('Austin candidate refresh requires --confirm-live');
}
const key = process.env.SERPAPI_KEY;
if (!key) throw new Error('SERPAPI_KEY is required for a live candidate refresh');
const target = seedTarget();
const connection = createDb(target.url, { max: 1 });

async function search(engine: 'google_events' | 'google_maps', query: string) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('api_key', key!);
  url.searchParams.set('engine', engine);
  url.searchParams.set('q', query);
  if (engine === 'google_maps') url.searchParams.set('ll', '@30.2672,-97.7431,12z');
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`SerpAPI ${engine} refresh failed with ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

try {
  const [events, maps] = await Promise.all([
    search('google_events', 'Austin events this weekend'),
    search('google_maps', 'fun group activities in Austin'),
  ]);
  const rows = [
    ...((events.events_results as Record<string, unknown>[] | undefined) ?? []).map((row) => ({
      row,
      source: 'serp_events' as const,
      category: 'event' as const,
    })),
    ...((maps.local_results as Record<string, unknown>[] | undefined) ?? []).map((row) => ({
      row,
      source: 'serp_maps' as const,
      category: 'place' as const,
    })),
  ].slice(0, 12);
  for (const { row, source, category } of rows) {
    const name = String(row.title ?? row.name ?? 'Austin activity');
    const url =
      typeof row.link === 'string' ? row.link : typeof row.website === 'string' ? row.website : null;
    const dedupeKey = createHash('sha256')
      .update(`${source}:${name}:${url ?? ''}`.toLowerCase())
      .digest('hex');
    await connection.db
      .insert(candidates)
      .values({
        id: uuidv7(),
        source,
        category,
        name,
        url,
        imageUrl: typeof row.thumbnail === 'string' ? row.thumbnail : null,
        address: typeof row.address === 'string' ? row.address : null,
        priceText: typeof row.price === 'string' ? row.price : null,
        rating: typeof row.rating === 'number' ? row.rating : null,
        raw: { ...row, refreshedFor: 'Austin weekend demo' },
        lastVerifiedAt: new Date(),
        dedupeKey,
      })
      .onConflictDoUpdate({
        target: candidates.dedupeKey,
        set: { name, url, raw: { ...row, refreshedFor: 'Austin weekend demo' }, lastVerifiedAt: new Date() },
      });
  }
  console.log(JSON.stringify({ ok: true, target: target.label, refreshed: rows.length }, null, 2));
} finally {
  await connection.sql.end({ timeout: 5 });
}
