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
  account: zAccountSummary,
  bioSnippet: z.string().nullable(),
  sharedTags: z.array(z.string()),
  reason: z.string(),
  starter: z.string(),
  activityIdea: z.string().nullable(),
  score: z.number(),
});
export type CommonGroundCardDTO = z.infer<typeof zCommonGroundCardDTO>;

export const zQuizAnswersBody = z.object({
  answers: z.array(z.object({ questionId: z.string(), answer: z.unknown() })),
});
export const zIntroRequestBody = z.object({
  toUserId: z.string(),
  firstMessage: z.string().max(280).optional(),
});
