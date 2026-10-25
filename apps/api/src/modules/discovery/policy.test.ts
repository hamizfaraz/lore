import { describe, expect, it } from 'vitest';
import { decayScores, matchScore, safeTags } from './policy';

describe('discovery privacy and ranking policy', () => {
  it('allows only broad safe tags and caps caption-derived tags at three', () => {
    expect(safeTags(['Climbing', 'Live Music', 'private address', '555-1212', 'Cooking'], 3)).toEqual([
      'climbing',
      'live music',
      'cooking',
    ]);
  });

  it('uses a fourteen-day half-life but preserves explicit removals', () => {
    const decayed = decayScores({ climbing: 0.8, running: -1 }, 14 * 86_400_000);
    expect(decayed.climbing).toBeCloseTo(0.4);
    expect(decayed.running).toBe(-1);
  });

  it('ranks from overlap, embeddings, and bounded serendipity', () => {
    const result = matchScore(
      ['climbing', 'coffee'],
      ['climbing', 'art'],
      [
        [1, 0],
        [1, 0],
      ],
    );
    expect(result.shared).toEqual(['climbing']);
    expect(result.score).toBeGreaterThan(0.5);
  });
});
