import { z } from 'zod';
import { zMediaKind, zTranscriptStatus } from '../enums';

export const zPresignBody = z.object({
  kind: z.enum(['image', 'video', 'audio']),
  mime: z.string(),
  bytes: z.number().int().positive().max(50 * 1024 * 1024),
});
export type PresignBody = z.infer<typeof zPresignBody>;

export const zPresignResponse = z.object({
  mediaId: z.string(),
  uploadUrl: z.string(),
  headers: z.record(z.string(), z.string()),
});
export type PresignResponse = z.infer<typeof zPresignResponse>;

export const zMediaDTO = z.object({
  id: z.string(),
  kind: zMediaKind,
  url: z.string(),
  thumbUrl: z.string().nullable(),
  mime: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  durationMs: z.number().nullable(),
  blurhash: z.string().nullable(),
  aiGenerated: z.boolean(),
  generator: z.string().nullable(),
  transcript: z.string().nullable(),
  transcriptStatus: zTranscriptStatus,
  altText: z.string().nullable().optional(),
});
export type MediaDTO = z.infer<typeof zMediaDTO>;
