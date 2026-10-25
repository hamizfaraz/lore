import { z } from 'zod';
import { zAccountSummary } from './users';

/** A Facebook friend who already has a LORE account, plus the viewer's follow state. */
export const zLoreFriend = zAccountSummary.extend({
  following: z.boolean(),
  pending: z.boolean().optional(),
});
export type LoreFriendDTO = z.infer<typeof zLoreFriend>;

export const zGraphTag = z.object({ tag: z.string(), from: z.literal('facebook') });
export type GraphTagDTO = z.infer<typeof zGraphTag>;

export const zGraphImportResult = z.object({
  grantedScopes: z.array(z.string()),
  suggestedTags: z.array(zGraphTag),
  friendsOnLore: z.array(zLoreFriend),
  importedAt: z.string(),
});
export type GraphImportResultDTO = z.infer<typeof zGraphImportResult>;

export const zConnectionsDTO = z.object({
  facebook: z
    .object({ fbUserId: z.string(), grantedScopes: z.array(z.string()), importedAt: z.string().nullable() })
    .nullable(),
  /** Present after C1-10. Tags mapped from Page likes, still marked as Facebook suggestions. */
  suggestedTags: z.array(zGraphTag).optional(),
  /** Present after C1-10. Facebook friends who are already on LORE. */
  friendsOnLore: z.array(zLoreFriend).optional(),
});
export type ConnectionsDTO = z.infer<typeof zConnectionsDTO>;

/** Body for POST /graph/suggestions — the subset of imported tags the user kept. */
export const zConfirmGraphTagsBody = z.object({
  tags: z.array(z.string().min(1).max(40)).max(60),
});
export type ConfirmGraphTagsBody = z.infer<typeof zConfirmGraphTagsBody>;
