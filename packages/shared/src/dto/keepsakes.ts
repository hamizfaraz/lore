import { z } from 'zod';

export const zCreateKeepsakeBody = z.object({ recapId: z.string().uuid() });
export type CreateKeepsakeBody = z.infer<typeof zCreateKeepsakeBody>;

export const zKeepsakeDTO = z.object({
  id: z.string(),
  recapId: z.string(),
  mintAddress: z.string().nullable(),
  txSignature: z.string().nullable(),
  network: z.string(),
  explorerUrl: z.string().nullable(),
  status: z.enum(['pending', 'minted', 'failed']),
});
export type KeepsakeDTO = z.infer<typeof zKeepsakeDTO>;
