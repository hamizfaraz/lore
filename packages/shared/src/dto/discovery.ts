import { z } from 'zod';
import { zIntroState } from '../enums';
import { zAccountSummary } from './users';

export const zIntroductionDTO = z.object({
  id: z.string(),
  from: zAccountSummary,
  to: zAccountSummary,
  basis: z.object({ sharedTags: z.array(z.string()), reason: z.string() }),
  firstMessage: z.string().nullable(),
  state: zIntroState,
  createdAt: z.string(),
  conversationId: z.string().nullable().optional(),
});
export type IntroductionDTO = z.infer<typeof zIntroductionDTO>;

export const zCommonGroundCardDTO = z.object({
  userId: z.string(),
  account: zAccountSummary,
  bioSnippet: z.string().nullable(),
  sharedTags: z.array(z.string()),
  reason: z.string(),
  starter: z.string(),
  activityIdea: z.string().nullable(),
  score: z.number(),
});
export type CommonGroundCardDTO = z.infer<typeof zCommonGroundCardDTO>;

export const zDiscoveryProfileDTO = z.object({
  explicitTags: z.array(z.string()),
  inferredTags: z.array(z.object({ tag: z.string(), score: z.number() })),
  removedTags: z.array(z.string()),
  frozen: z.boolean(),
  discoverable: z.boolean(),
  bioSnippet: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type DiscoveryProfileDTO = z.infer<typeof zDiscoveryProfileDTO>;

export const zDiscoveryOverviewDTO = z.object({
  profile: zDiscoveryProfileDTO,
  matches: z.array(zCommonGroundCardDTO),
  introductions: z.array(zIntroductionDTO),
});
export type DiscoveryOverviewDTO = z.infer<typeof zDiscoveryOverviewDTO>;

export const zQuizAnswersBody = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), answer: z.unknown() })).max(8),
});
export type QuizAnswersBody = z.infer<typeof zQuizAnswersBody>;

export const zDiscoveryProfileBody = z.object({
  explicitTags: z.array(z.string()).max(24).optional(),
  removedTags: z.array(z.string()).max(24).optional(),
  frozen: z.boolean().optional(),
  discoverable: z.boolean().optional(),
  bioSnippet: z.string().max(180).nullable().optional(),
});
export type DiscoveryProfileBody = z.infer<typeof zDiscoveryProfileBody>;

export const zIntroRequestBody = z.object({
  toUserId: z.string().uuid(),
  firstMessage: z.string().max(280).optional(),
});
export type IntroRequestBody = z.infer<typeof zIntroRequestBody>;

export const zIntroDecisionBody = z.object({ action: z.enum(['accept', 'decline']) });
export const zIntroStarterBody = z.object({ firstMessage: z.string().min(1).max(280) });
