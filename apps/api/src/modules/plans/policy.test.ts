import { describe, expect, it } from 'vitest';
import {
  applyHardConstraints,
  ensureAtHomeOption,
  maximinDiverse,
  preferenceSummary,
  validCandidate,
} from './policy';
import type { PlanCandidate } from './types';

const candidate = (id: string, overrides: Partial<PlanCandidate> = {}): PlanCandidate => ({
  id,
  source: 'seed',
  category: 'place',
  name: id,
  url: 'https://example.com/place',
  imageUrl: null,
  address: null,
  startsAt: null,
  priceText: '$10',
  priceAmount: 10,
  travelMinutes: 10,
  rating: null,
  lastVerifiedAt: new Date('2026-10-24T00:00:00Z'),
  dedupeKey: id,
  ...overrides,
});

describe('plan policy', () => {
  it('enforces known budget, travel, and time limits while keeping unknown price labeled for later', () => {
    const inWindow = new Date('2026-10-25T18:00:00Z');
    const rows = [
      candidate('good', { startsAt: inWindow }),
      candidate('unknown-price', { startsAt: inWindow, priceText: null, priceAmount: null }),
      candidate('expensive', { startsAt: inWindow, priceAmount: 40 }),
      candidate('far', { startsAt: inWindow, travelMinutes: 50 }),
      candidate('late', { startsAt: new Date('2026-10-26T23:00:00Z') }),
    ];
    const filtered = applyHardConstraints(rows, [
      { key: 'budget_max', value: 20 },
      { key: 'travel_minutes', value: 20 },
      {
        key: 'time_windows',
        value: [{ start: '2026-10-25T17:00:00Z', end: '2026-10-25T20:00:00Z' }],
      },
    ]);
    expect(filtered.map((row) => row.id)).toEqual(['good', 'unknown-price']);
  });

  it('always adds an at-home option and rejects unsourced venues', () => {
    const home = candidate('home', { category: 'at_home', url: null, travelMinutes: 0 });
    expect(ensureAtHomeOption([candidate('park')], home).map((row) => row.id)).toContain('home');
    expect(validCandidate(candidate('bad', { url: null }))).toBe(false);
    expect(validCandidate(home)).toBe(true);
  });

  it('orders by maximin fit and keeps category diversity', () => {
    const rows = [
      candidate('a', { category: 'place' }),
      candidate('b', { category: 'event' }),
      candidate('c', { category: 'place' }),
    ];
    const option = (candidateId: string, fits: Array<'great' | 'ok' | 'conflict'>) => ({
      candidateId,
      headline: candidateId,
      why: candidateId,
      fitByMember: fits.map((fit, index) => ({ userId: `u${index}`, fit, note: '' })),
      logistics: {},
    });
    const ranked = maximinDiverse(
      {
        options: [
          option('a', ['great', 'conflict']),
          option('c', ['great', 'great']),
          option('b', ['ok', 'ok']),
        ],
        noFeasibleOption: false,
      },
      rows,
    );
    expect(ranked.map((row) => row.candidateId)).toEqual(['c', 'b', 'a']);
  });

  it('never reveals private preference text or its owner', () => {
    const summary = preferenceSummary([
      { userId: 'secret-owner', key: 'dietary', value: 'secret-value', visibility: 'ai_only' },
      { userId: 'u2', key: 'travel_minutes', value: 20, visibility: 'group' },
    ]);
    expect(summary).toContain('Some private constraints were honored.');
    expect(summary).toContain('travel_minutes');
    expect(summary).not.toContain('secret-owner');
    expect(summary).not.toContain('secret-value');
  });
});
