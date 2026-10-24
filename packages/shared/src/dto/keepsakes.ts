import { z } from 'zod';

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
