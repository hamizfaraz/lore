import { describe, expect, it, vi } from 'vitest';
import { sanitizeImpactEvent } from './policy';
import { SnowflakeClient } from './snowflake';

describe('SnowflakeClient payload', () => {
  it('reuses the request id when a retryable SQL request is retried', async () => {
    const urls: string[] = [];
    let attempts = 0;
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      urls.push(String(url));
      attempts += 1;
      if (attempts === 1) return new Response('{}', { status: 429 });
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });
    const client = new SnowflakeClient(
      { account: 'test-account', pat: 'test-pat', warehouse: 'LORE_WH', database: 'LORE' },
      fetcher as typeof fetch,
    );
    await client.insert([]);
    expect(urls).toEqual([]);
    const clean = sanitizeImpactEvent({ kind: 'intro_accepted', objectId: 'intro' }, 'salt');
    await client.insert([{ eventId: 'event-retry', ...clean }]);
    expect(urls[0]).toBe(urls[1]);
  });

  it('contains only pseudonymous event rows and uses one idempotent MERGE request', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const client = new SnowflakeClient(
      { account: 'test-account', pat: 'test-pat', warehouse: 'LORE_WH', database: 'LORE' },
      fetcher as typeof fetch,
    );
    const clean = sanitizeImpactEvent(
      {
        kind: 'plan_confirmed',
        groupId: 'real-group-id',
        actorId: 'actor@example.com',
        objectId: 'real-proposal-id',
        props: { voteCount: 2, caption: 'private plan text' },
        at: new Date('2026-10-24T12:00:00Z'),
      },
      'salt',
    );
    await client.insert([{ eventId: 'event-1', ...clean }]);
    const merge = requests.at(-1)!;
    const payload = String(merge.init?.body);
    expect(payload).toContain('MERGE INTO IMPACT_EVENTS');
    expect(payload).toContain('event-1');
    expect(merge.url).toContain('requestId=');
    expect(payload).not.toContain('real-group-id');
    expect(payload).not.toContain('actor@example.com');
    expect(payload).not.toContain('real-proposal-id');
    expect(payload).not.toContain('private plan text');
  });
});
