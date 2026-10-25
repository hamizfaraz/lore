import { z } from 'zod';
import { zCategory, zPrefKey, zPrefVisibility, zProposalStatus, zRsvpStatus, zVoteResponse } from '../enums';

export const zPlanOptionDTO = z.object({
  candidateId: z.string(),
  name: z.string(),
  category: zCategory,
  headline: z.string(),
  why: z.string(),
  imageUrl: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceDomain: z.string().nullable(),
  lastVerifiedAt: z.string().nullable(),
  priceText: z.string().nullable(),
  priceUnverified: z.boolean(),
  whenText: z.string().nullable(),
  travelText: z.string().nullable(),
  fitByMember: z.array(z.object({ userId: z.string(), fit: z.enum(['great', 'ok', 'conflict']) })),
  tally: z.object({ yes: z.number(), flexible: z.number(), no: z.number(), veto: z.number() }),
  myResponse: zVoteResponse.nullable(),
});
export type PlanOptionDTO = z.infer<typeof zPlanOptionDTO>;

export const zPlanCardDTO = z.object({
  id: z.string(),
  conversationId: z.string(),
  version: z.number(),
  status: zProposalStatus,
  header: z.string(),
  evidence: z.string().nullable(),
  options: z.array(zPlanOptionDTO),
  compromiseNote: z.string().nullable(),
  noFeasibleOption: z.boolean(),
  askToRelax: z.string().nullable(),
  decorativeImageUrl: z.string().nullable(),
  degraded: z.boolean(),
  createdBy: z.enum(['ai', 'user']),
});
export type PlanCardDTO = z.infer<typeof zPlanCardDTO>;

export const zPlanConfirmedCardDTO = z.object({
  planId: z.string(),
  proposalId: z.string(),
  title: z.string(),
  startsAt: z.string(),
  tz: z.string(),
  placeUrl: z.string().nullable(),
  regionLabel: z.string().nullable(),
  confirmedBy: z.object({ userId: z.string(), displayName: z.string() }),
  rsvps: z.array(z.object({ userId: z.string(), status: zRsvpStatus })),
  icsUrl: z.string(),
});
export type PlanConfirmedCardDTO = z.infer<typeof zPlanConfirmedCardDTO>;

export const zSuggestBody = z.object({ request: z.string().max(280).optional() });
export type SuggestBody = z.infer<typeof zSuggestBody>;
export const zVoteBody = z.object({ candidateId: z.string(), response: zVoteResponse });
export type VoteBody = z.infer<typeof zVoteBody>;
export const zRefineBody = z.object({ instruction: z.string().min(1).max(200) });
export type RefineBody = z.infer<typeof zRefineBody>;
export const zConfirmBody = z.object({ candidateId: z.string(), startsAt: z.string(), tz: z.string() });
export type ConfirmBody = z.infer<typeof zConfirmBody>;
export const zPreferenceBody = z.object({
  proposalId: z.string().optional(),
  key: zPrefKey,
  value: z.unknown(),
  visibility: zPrefVisibility,
});
export type PreferenceBody = z.infer<typeof zPreferenceBody>;

export const zPreferenceDTO = zPreferenceBody.extend({
  id: z.string(),
  conversationId: z.string(),
  userId: z.string(),
  createdAt: z.string(),
});
export type PreferenceDTO = z.infer<typeof zPreferenceDTO>;

export const zPlansOverviewDTO = z.object({
  proposals: z.array(zPlanCardDTO),
  confirmed: z.array(zPlanConfirmedCardDTO),
  preferences: z.array(zPreferenceDTO),
});
export type PlansOverviewDTO = z.infer<typeof zPlansOverviewDTO>;

export const zRsvpBody = z.object({ status: zRsvpStatus });

export const zSuggestResult = z.object({
  plan: zPlanCardDTO,
  question: z
    .object({ key: zPrefKey, prompt: z.string(), replies: z.array(z.string()).min(2).max(4) })
    .nullable(),
});
export type SuggestResult = z.infer<typeof zSuggestResult>;
