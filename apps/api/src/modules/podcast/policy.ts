import { badRequest, conflict } from '../../lib/errors';

export const PODCAST_CLIP_MS = 20_000;
export const PODCAST_GAP_MS = 300;

export function assertPodcastClip(
  input: { durationMs: number; kind: string; ownerUserId: string | null },
  userId: string,
) {
  if (input.kind !== 'audio') throw badRequest('Podcast contributions must be voice clips');
  if (input.ownerUserId !== userId) throw badRequest('Use a voice clip uploaded by you');
  if (input.durationMs !== PODCAST_CLIP_MS) throw badRequest('Podcast clips must be exactly 20 seconds');
}

export function assertFinishable(input: { wrapped: boolean; required: string[]; engaged: string[] }) {
  if (!input.wrapped) throw conflict('The host must wrap the show before finishing');
  const engaged = new Set(input.engaged);
  const missing = input.required.filter((userId) => !engaged.has(userId));
  if (missing.length)
    throw conflict(`Waiting for ${missing.length} required participant${missing.length === 1 ? '' : 's'}`);
}

export type TimelineItem =
  | { kind: 'tone'; label: 'intro' | 'outro'; durationMs: number }
  | { kind: 'clip'; contributionId: string; userId: string; durationMs: number }
  | { kind: 'gap'; durationMs: number };

export function renderTimeline(contributions: Array<{ id: string; userId: string }>): TimelineItem[] {
  const timeline: TimelineItem[] = [{ kind: 'tone', label: 'intro', durationMs: 500 }];
  contributions.forEach((contribution, index) => {
    timeline.push({
      kind: 'clip',
      contributionId: contribution.id,
      userId: contribution.userId,
      durationMs: PODCAST_CLIP_MS,
    });
    if (index < contributions.length - 1) timeline.push({ kind: 'gap', durationMs: PODCAST_GAP_MS });
  });
  timeline.push({ kind: 'tone', label: 'outro', durationMs: 500 });
  return timeline;
}
