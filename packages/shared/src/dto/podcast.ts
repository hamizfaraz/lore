import { z } from 'zod';
import { zPodcastShowState } from '../enums';

export const zPodcastUpdateDTO = z.object({
  showId: z.string(),
  contributions: z.number(),
  engaged: z.array(z.string()),
  finishEnabled: z.boolean(),
  missing: z.array(z.string()),
  state: zPodcastShowState,
});
export type PodcastUpdateDTO = z.infer<typeof zPodcastUpdateDTO>;

export const zPodcastInviteCardDTO = z.object({ showId: z.string(), title: z.string(), stationTopic: z.string().nullable() });
export type PodcastInviteCardDTO = z.infer<typeof zPodcastInviteCardDTO>;

export const zCreateShowBody = z.object({ conversationId: z.string(), title: z.string().max(80) });
export const zVoiceContributionBody = z.object({ mediaId: z.string(), replyToId: z.string().optional() });
export const zBranchBody = z.object({ topic: z.string().max(80) });
