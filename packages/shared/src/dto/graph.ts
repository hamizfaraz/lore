import { z } from 'zod';
import { zAccountSummary } from './users';

export const zGraphImportResult = z.object({
  grantedScopes: z.array(z.string()),
  suggestedTags: z.array(z.object({ tag: z.string(), from: z.literal('facebook') })),
  friendsOnLore: z.array(zAccountSummary.extend({ following: z.boolean() })),
  importedAt: z.string(),
});
export type GraphImportResultDTO = z.infer<typeof zGraphImportResult>;

export const zConnectionsDTO = z.object({
  facebook: z
    .object({ fbUserId: z.string(), grantedScopes: z.array(z.string()), importedAt: z.string().nullable() })
    .nullable(),
});
export type ConnectionsDTO = z.infer<typeof zConnectionsDTO>;
