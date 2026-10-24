import { z } from 'zod';

export const zTranscribeBody = z.object({ mediaId: z.string() });
export const zTranscribeResult = z.object({
  mediaId: z.string(),
  transcript: z.string().nullable(),
  status: z.enum(['pending', 'done', 'failed']),
});
export type TranscribeResult = z.infer<typeof zTranscribeResult>;
