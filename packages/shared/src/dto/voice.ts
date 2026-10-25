import { z } from 'zod';

export const zTranscribeBody = z.object({ mediaId: z.string() });
export const zTranscribeResult = z.object({
  mediaId: z.string(),
  transcript: z.string().nullable(),
  status: z.enum(['pending', 'done', 'failed']),
  degraded: z.boolean(),
});
export type TranscribeResult = z.infer<typeof zTranscribeResult>;

/** Browser → LORE live-caption proxy. Audio itself is sent as binary 80 ms PCM16 frames. */
export const zLiveVoiceClientMessage = z.object({ type: z.literal('end') });
export type LiveVoiceClientMessage = z.infer<typeof zLiveVoiceClientMessage>;

/** LORE live-caption proxy → browser. The authenticated uploader is always the speaker. */
export const zLiveVoiceServerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), sessionId: z.string() }),
  z.object({
    type: z.literal('transcript'),
    text: z.string(),
    final: z.boolean(),
    cumulative: z.literal(true),
    speakerUserId: z.string(),
  }),
  z.object({
    type: z.literal('error'),
    code: z.enum(['BAD_FRAME', 'BAD_MESSAGE', 'PROVIDER_ERROR', 'SESSION_LIMIT']),
    message: z.string(),
  }),
]);
export type LiveVoiceServerMessage = z.infer<typeof zLiveVoiceServerMessage>;

/** 80 ms × 24 kHz × mono × 16-bit. */
export const LIVE_VOICE_FRAME_BYTES = 3_840;
