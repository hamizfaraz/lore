import { z } from 'zod';
import { zFamilyStoryState } from '../enums';

export const zFamilyStoryCardDTO = z.object({
  id: z.string(),
  conversationId: z.string(),
  title: z.string(),
  periodLabel: z.string(),
  state: zFamilyStoryState,
  coverUrl: z.string().nullable(),
  chapterCount: z.number(),
  flagsOpen: z.number(),
  contributors: z.array(
    z.object({ userId: z.string(), displayName: z.string(), avatarUrl: z.string().nullable() }),
  ),
});
export type FamilyStoryCardDTO = z.infer<typeof zFamilyStoryCardDTO>;

export const zCreateFamilyStoryBody = z.object({ from: z.string(), to: z.string() });

export const zFamilySourceDTO = z.object({
  sourceMessageId: z.string().uuid(),
  contributorUserId: z.string().uuid(),
  contributorName: z.string(),
  contributorAvatarUrl: z.string().nullable(),
  createdAt: z.string(),
  text: z.string(),
  media: z.array(
    z.object({
      id: z.string().uuid(),
      kind: z.string(),
      transcript: z.string().nullable(),
      caption: z.string().nullable(),
    }),
  ),
  include: z.boolean(),
  correction: z.string().nullable(),
});
export type FamilySourceDTO = z.infer<typeof zFamilySourceDTO>;

export const zFamilyStoryDetailDTO = zFamilyStoryCardDTO.extend({
  sources: z.array(zFamilySourceDTO),
  chapters: z.array(
    z.object({
      heading: z.string(),
      summary: z.string(),
      items: z.array(
        z.object({
          sourceMessageId: z.string().uuid(),
          contributorUserId: z.string().uuid(),
          contributorName: z.string(),
          text: z.string(),
        }),
      ),
    }),
  ),
  flags: z.array(
    z.object({
      sourceMessageId: z.string().uuid(),
      issue: z.enum(['date_unclear', 'unsupported_claim', 'sensitive']),
    }),
  ),
  canGenerate: z.boolean(),
  canShare: z.boolean(),
});
export type FamilyStoryDetailDTO = z.infer<typeof zFamilyStoryDetailDTO>;

export const zFamilyContributionBody = z
  .object({ include: z.boolean().optional(), correction: z.string().trim().max(1000).nullable().optional() })
  .refine((value) => value.include !== undefined || value.correction !== undefined, 'No changes supplied');
export type FamilyContributionBody = z.infer<typeof zFamilyContributionBody>;
export const zFamilyShareBody = z.object({
  target: z.enum(['private', 'group_draft']),
  accountId: z.string().uuid().optional(),
});
export type FamilyShareBody = z.infer<typeof zFamilyShareBody>;
