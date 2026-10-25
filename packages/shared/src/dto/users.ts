import { z } from 'zod';
import { zAccountType, zMemberRole, zVisibility } from '../enums';

export const zAccountSummary = z.object({
  id: z.string(),
  type: zAccountType,
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  visibility: zVisibility,
  /** for group accounts: member avatars for the stacked badge */
  memberAvatars: z.array(z.string().nullable()).optional(),
  conversationId: z.string().nullable().optional(),
});
export type AccountSummaryDTO = z.infer<typeof zAccountSummary>;

export const zActingAccount = zAccountSummary.extend({
  role: zMemberRole.nullable(),
  canPublishDirect: z.boolean(),
});
export type ActingAccountDTO = z.infer<typeof zActingAccount>;

export const zMe = z.object({
  user: z.object({ id: z.string(), email: z.string(), name: z.string(), image: z.string().nullable() }),
  personalAccount: zAccountSummary.nullable(),
  groupAccounts: z.array(zActingAccount),
  onboarded: z.boolean(),
  facebookLinked: z.boolean(),
  pendingApprovals: z.number(),
});
export type MeDTO = z.infer<typeof zMe>;

export const zUpdateProfileBody = z.object({
  handle: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9._]+$/, 'lowercase letters, numbers, dots and underscores')
    .optional(),
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(150).optional(),
  avatarMediaId: z.string().nullable().optional(),
  visibility: zVisibility.optional(),
  onboarded: z.boolean().optional(),
});
export type UpdateProfileBody = z.infer<typeof zUpdateProfileBody>;

export const zProfile = zAccountSummary.extend({
  bio: z.string().nullable(),
  counts: z.object({ posts: z.number(), followers: z.number(), following: z.number() }),
  viewer: z.object({
    isSelf: z.boolean(),
    following: z.boolean(),
    pending: z.boolean(),
    canSeePosts: z.boolean(),
    isMember: z.boolean(),
    blocked: z.boolean().optional(),
  }),
  members: z.array(zAccountSummary).optional(),
  publicGroups: z.array(zAccountSummary).optional(),
});
export type ProfileDTO = z.infer<typeof zProfile>;
