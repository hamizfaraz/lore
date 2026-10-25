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

export const zPodcastInviteCardDTO = z.object({
  showId: z.string(),
  title: z.string(),
  stationTopic: z.string().nullable(),
});
export type PodcastInviteCardDTO = z.infer<typeof zPodcastInviteCardDTO>;

export const zCreateShowBody = z.object({ conversationId: z.string(), title: z.string().max(80) });
export const zVoiceContributionBody = z.object({ mediaId: z.string(), replyToId: z.string().optional() });
export const zBranchBody = z.object({ topic: z.string().max(80) });

export const zPodcastContributionDTO = z.object({
  id: z.string().uuid(),
  stationId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  mediaId: z.string().uuid(),
  replyToId: z.string().uuid().nullable(),
  durationMs: z.number().int(),
  transcript: z.string().nullable(),
  day: z.string(),
  createdAt: z.string(),
});
export type PodcastContributionDTO = z.infer<typeof zPodcastContributionDTO>;

export const zPodcastStationDTO = z.object({
  id: z.string().uuid(),
  parentStationId: z.string().uuid().nullable(),
  topic: z.string().nullable(),
  participantIds: z.array(z.string().uuid()),
  state: z.enum(['open', 'wrapped']),
  contributions: z.array(zPodcastContributionDTO),
});
export type PodcastStationDTO = z.infer<typeof zPodcastStationDTO>;

export const zPodcastShowDetailDTO = zPodcastUpdateDTO.extend({
  conversationId: z.string().uuid(),
  title: z.string(),
  hostUserId: z.string().uuid(),
  wrapped: z.boolean(),
  requiredParticipants: z.array(
    z.object({ userId: z.string().uuid(), displayName: z.string(), contributed: z.boolean() }),
  ),
  stations: z.array(zPodcastStationDTO),
  audioUrl: z.string().nullable(),
  videoUrl: z.string().nullable().optional(),
});
export type PodcastShowDetailDTO = z.infer<typeof zPodcastShowDetailDTO>;
