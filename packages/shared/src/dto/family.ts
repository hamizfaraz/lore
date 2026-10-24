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
