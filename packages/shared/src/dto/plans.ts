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
export const zVoteBody = z.object({ candidateId: z.string(), response: zVoteResponse });
export const zRefineBody = z.object({ instruction: z.string().min(1).max(200) });
export const zConfirmBody = z.object({ candidateId: z.string(), startsAt: z.string(), tz: z.string() });
export const zPreferenceBody = z.object({
  proposalId: z.string().optional(),
  key: zPrefKey,
  value: z.unknown(),
  visibility: zPrefVisibility,
});
