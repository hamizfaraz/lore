import { z } from 'zod';
import {
  zApprovalDecision,
  zDraftState,
  zPolicyMode,
  zPostKind,
  zPostSourceKind,
  zVisibility,
} from '../enums';
import { zMediaDTO } from './media';
import { zAccountSummary } from './users';

export const zPolicyDTO = z.object({
  accountId: z.string(),
  mode: zPolicyMode,
  threshold: z.number().int().positive().nullable(),
  eligibleRoles: z.array(z.string()),
  storyMode: zPolicyMode.nullable(),
  updatedAt: z.string().nullable(),
});
export type PolicyDTO = z.infer<typeof zPolicyDTO>;

export const zPolicyInput = z.object({
  mode: zPolicyMode,
  threshold: z.number().int().positive().nullable().optional(),
  eligibleRoles: z.array(z.string()).optional(),
  storyMode: zPolicyMode.nullable().optional(),
});
export type PolicyInput = z.infer<typeof zPolicyInput>;

export const zCreateGroupAccountBody = z.object({
  handle: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9._]+$/),
  displayName: z.string().min(1).max(60),
  bio: z.string().max(150).optional(),
  avatarMediaId: z.string().nullable().optional(),
  visibility: zVisibility.default('public'),
  policy: zPolicyInput,
});
export type CreateGroupAccountBody = z.infer<typeof zCreateGroupAccountBody>;

export const zDraftSource = z.object({ kind: zPostSourceKind, id: z.string().optional() });

export const zCreateDraftBody = z.object({
  accountId: z.string(),
  conversationId: z.string(),
  kind: zPostKind,
  caption: z.string().max(2200).default(''),
  mediaIds: z.array(z.string()).min(1).max(10),
  audioLabel: z.string().optional(),
  source: zDraftSource.optional(),
  /** submit immediately (AI drafts are always submitted) */
  submit: z.boolean().optional(),
});
export type CreateDraftBody = z.infer<typeof zCreateDraftBody>;

export const zPatchDraftBody = z.object({
  caption: z.string().max(2200).optional(),
  mediaIds: z.array(z.string()).min(1).max(10).optional(),
  audioLabel: z.string().nullable().optional(),
});
export type PatchDraftBody = z.infer<typeof zPatchDraftBody>;

export const zApprovalBody = z.object({ decision: zApprovalDecision, note: z.string().max(280).optional() });
export type ApprovalBody = z.infer<typeof zApprovalBody>;

export const zDraftCardDTO = z.object({
  id: z.string(),
  account: zAccountSummary,
  conversationId: z.string(),
  kind: zPostKind,
  caption: z.string(),
  media: z.array(zMediaDTO),
  version: z.number(),
  state: zDraftState,
  createdByAi: z.boolean(),
  createdBy: z.object({ userId: z.string(), displayName: z.string() }).nullable(),
  policy: z
    .object({ mode: zPolicyMode, threshold: z.number().nullable(), eligibleVoterIds: z.array(z.string()) })
    .nullable(),
  needed: z.number(),
  approvals: z.array(
    z.object({
      userId: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      decision: zApprovalDecision,
      note: z.string().nullable(),
    }),
  ),
  voters: z.array(
    z.object({ userId: z.string(), displayName: z.string(), avatarUrl: z.string().nullable() }),
  ),
  publishedPostId: z.string().nullable(),
  sourceKind: zPostSourceKind,
  updatedAt: z.string(),
});
export type DraftCardDTO = z.infer<typeof zDraftCardDTO>;
