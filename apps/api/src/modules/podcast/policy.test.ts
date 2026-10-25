import { describe, expect, it } from 'vitest';
import { assertFinishable, assertPodcastClip, renderTimeline } from './policy';
import { renderPodcastAudio } from './render';

describe('podcast policy', () => {
  it('requires an owned, exact 20-second voice clip', () => {
    expect(() => assertPodcastClip({ durationMs: 19_000, kind: 'audio', ownerUserId: 'u1' }, 'u1')).toThrow(
      'exactly 20 seconds',
    );
    expect(() =>
      assertPodcastClip({ durationMs: 20_000, kind: 'audio', ownerUserId: 'u1' }, 'u1'),
    ).not.toThrow();
  });

  it('blocks finish before wrap or while a required participant is missing', () => {
    expect(() => assertFinishable({ wrapped: false, required: ['u1'], engaged: ['u1'] })).toThrow('wrap');
    expect(() => assertFinishable({ wrapped: true, required: ['u1', 'u2'], engaged: ['u1'] })).toThrow(
      'Waiting',
    );
  });

  it('orders clips with 300 ms gaps and intro/outro tones', () => {
    const timeline = renderTimeline([
      { id: 'c1', userId: 'u1' },
      { id: 'c2', userId: 'u2' },
    ]);
    expect(timeline.map((item) => item.kind)).toEqual(['tone', 'clip', 'gap', 'clip', 'tone']);
    expect(timeline[2]).toEqual({ kind: 'gap', durationMs: 300 });
    expect(timeline.filter((item) => item.kind === 'clip')).toMatchObject([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
  });

  it('renders a playable MP3 envelope for the audio-only show', async () => {
    const audio = await renderPodcastAudio([]);
    expect(audio.length).toBeGreaterThan(1_000);
    expect(audio.subarray(0, 3).toString()).toBe('ID3');
  });
});
