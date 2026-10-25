import { z } from 'zod';
import { zRecapLayout, zRecapState } from '../enums';
import { zMediaDTO } from './media';

export const zRecapCardDTO = z.object({
  id: z.string(),
  conversationId: z.string(),
  title: z.string(),
  caption: z.string(),
  layout: zRecapLayout,
  state: zRecapState,
  coverUrl: z.string().nullable(),
  coverAiGenerated: z.boolean(),
  collageUrl: z.string().nullable(),
  media: z.array(zMediaDTO),
  musicLabel: z.string().nullable(),
  createdByAi: z.boolean(),
  factsUsed: z.array(z.object({ claim: z.string(), sourceMessageId: z.string() })),
});
export type RecapCardDTO = z.infer<typeof zRecapCardDTO>;

export const zCreateRecapBody = z.object({
  eventId: z.string().optional(),
  planId: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
});
export type CreateRecapBody = z.infer<typeof zCreateRecapBody>;
export const zPatchRecapBody = z.object({
  title: z.string().optional(),
  caption: z.string().optional(),
  layout: zRecapLayout.optional(),
  mediaIds: z.array(z.string()).optional(),
  regenerateCover: z.boolean().optional(),
});
export type PatchRecapBody = z.infer<typeof zPatchRecapBody>;
export const zRecapConsentBody = z.object({ mediaId: z.string(), include: z.boolean() });
export type RecapConsentBody = z.infer<typeof zRecapConsentBody>;
export const zProposePostBody = z.object({ accountId: z.string(), caption: z.string().optional() });
export type ProposePostBody = z.infer<typeof zProposePostBody>;

export const zShareRecapBody = z.object({ target: z.enum(['chat', 'story']) });
export type ShareRecapBody = z.infer<typeof zShareRecapBody>;

export const zRecapListDTO = z.object({ recaps: z.array(zRecapCardDTO) });
export type RecapListDTO = z.infer<typeof zRecapListDTO>;
