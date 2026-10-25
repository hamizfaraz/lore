import { describe, expect, it } from 'vitest';
import { clusterMedia, consentedMedia, groundedRecap, removeNearDuplicates } from './policy';
import type { MemoryMedia } from './types';

const media = (id: string, minute: number, overrides: Partial<MemoryMedia> = {}): MemoryMedia => ({
  id,
  ownerUserId: 'u1',
  kind: 'image',
  mime: 'image/jpeg',
  width: 100,
  height: 100,
  durationMs: null,
  blurhash: null,
  aiGenerated: false,
  generator: null,
  transcript: null,
  transcriptStatus: 'none',
  captionAi: null,
  consentScope: null,
  createdAt: new Date(Date.UTC(2026, 9, 24, 18, minute)),
  sourceMessageIds: [`m-${id}`],
  quality: 0.8,
  perceptualHash: null,
  ...overrides,
});

describe('memory composition policy', () => {
  it('forms clusters of at least three and splits gaps over 90 minutes', () => {
    const clusters = clusterMedia([
      media('a', 0),
      media('b', 20),
      media('c', 60),
      media('d', 151),
      media('e', 160),
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the best near-duplicate and permanently excludes revoked or scoped-out media', () => {
    const rows = [
      media('best', 0, { perceptualHash: '0000000000000000', quality: 0.95 }),
      media('duplicate', 1, { perceptualHash: '0000000000000001', quality: 0.4 }),
      media('revoked', 2),
      media('scoped-out', 3, { consentScope: { recaps: false } }),
    ];
    const deduped = removeNearDuplicates(rows);
    expect(deduped.map((item) => item.id)).not.toContain('duplicate');
    expect(
      consentedMedia(deduped, [{ recapId: 'r1', mediaId: 'revoked', ownerUserId: 'u1', include: false }]).map(
        (item) => item.id,
      ),
    ).toEqual(['best']);
  });

  it('rejects unsupported facts and media ids', () => {
    const base = {
      title: 'Night out',
      caption: 'Great night',
      orderedMediaIds: ['a'],
      coverMediaId: 'a',
      layout: 'collage' as const,
      coverPrompt: 'warm',
      musicVibe: 'cozy',
      factsUsed: [{ claim: 'Supported', sourceMessageId: 'm-a' }],
    };
    expect(
      groundedRecap(base, [{ id: 'm-a', body: 'Supported', createdAt: new Date() }], [media('a', 0)]),
    ).toEqual(base);
    expect(() =>
      groundedRecap(
        { ...base, factsUsed: [{ claim: 'Invented', sourceMessageId: 'missing' }] },
        [],
        [media('a', 0)],
      ),
    ).toThrow(/unknown message/i);
    expect(() =>
      groundedRecap(
        { ...base, orderedMediaIds: ['invented'] },
        [{ id: 'm-a', body: null, createdAt: new Date() }],
        [media('a', 0)],
      ),
    ).toThrow(/unknown media/i);
  });
});
