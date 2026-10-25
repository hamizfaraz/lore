import { describe, expect, it, vi } from 'vitest';
import { aggregateLocal, ImpactService, type ImpactDependencies } from './service';
import type { ImpactEventRow } from './types';

const base = new Date('2026-10-24T12:00:00Z');
const row = (overrides: Partial<ImpactEventRow>): ImpactEventRow => ({
  eventId: 'event-1',
  at: base,
  kind: 'plan_suggested',
  groupHash: 'g'.repeat(64),
  actorHash: 'a'.repeat(64),
  props: { objectHash: 'o'.repeat(64) },
  ...overrides,
});

describe('ImpactService', () => {
  it('does not advance the composite cursor until a batch succeeds, then resumes without a gap', async () => {
    const events = [row({ eventId: 'a' }), row({ eventId: 'b' })];
    let cursor: { lastAt: Date; lastEventId: string } | null = null;
    const insert = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce(undefined);
    const store = {
      record: vi.fn(),
      cursor: vi.fn(async () => cursor),
      batchAfter: vi.fn(async () => (cursor ? [] : events)),
      advance: vi.fn(async (_name: string, next: Exclude<typeof cursor, null>) => {
        cursor = next;
      }),
      recent: vi.fn(async () => events),
    };
    const service = new ImpactService({
      store,
      snowflake: { configured: true, insert, aggregateSummary: vi.fn(), pulse: vi.fn() },
      cache: () => ({ get: vi.fn(async () => null), setex: vi.fn(async () => 'OK') }),
      now: () => base,
      salt: 'salt',
    } as unknown as ImpactDependencies);
    await expect(service.sync()).rejects.toThrow('temporary');
    expect(cursor).toBeNull();
    await expect(service.sync()).resolves.toEqual({ synced: 2, configured: true });
    expect(cursor).toEqual({ lastAt: base, lastEventId: 'b' });
    expect(insert.mock.calls[0]![0]).toEqual(insert.mock.calls[1]![0]);
  });

  it('surfaces a confirmed plan in local aggregates well inside two minutes', () => {
    const objectHash = 'p'.repeat(64);
    const summary = aggregateLocal(
      [
        row({ eventId: 'intent', kind: 'plan_suggested', at: base, props: { objectHash } }),
        row({
          eventId: 'confirm',
          kind: 'plan_confirmed',
          at: new Date(base.getTime() + 90_000),
          props: { objectHash },
        }),
      ],
      new Date(base.getTime() + 90_000),
    );
    expect(summary.metrics.find((metric) => metric.key === 'confirmed_per_active_group')?.value).toBe(1);
    expect(summary.metrics.find((metric) => metric.key === 'median_confirm_minutes')?.value).toBe(1.5);
    expect(summary.series[0]?.points.at(-1)?.v).toBe(1);
  });
});
