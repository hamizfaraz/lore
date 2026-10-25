import { z } from 'zod';
import { zInitiative, zMemoryKind, zSensitivity } from '../enums';

export const zPersonaDTO = z.object({
  id: z.string(),
  conversationId: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  tone: z.array(z.string()),
  interests: z.array(z.string()),
  boundaries: z.string().nullable(),
  initiative: zInitiative,
  quietHours: z.object({ start: z.string(), end: z.string(), tz: z.string() }).nullable(),
  allowHistory: z.boolean(),
  allowNews: z.boolean(),
  allowImages: z.boolean(),
  allowPlans: z.boolean(),
  allowLocation: z.boolean(),
  surpriseImagesPerWeek: z.number(),
  enabled: z.boolean(),
  mutedUntil: z.string().nullable().optional(),
});
export type PersonaDTO = z.infer<typeof zPersonaDTO>;

export const zPersonaUpdateBody = zPersonaDTO
  .omit({ id: true, conversationId: true, avatarUrl: true, mutedUntil: true })
  .partial()
  .extend({
    avatarMediaId: z.string().nullable().optional(),
    preset: z.enum(['milo', 'juniper', 'sol', 'custom']).optional(),
  });
export type PersonaUpdateBody = z.infer<typeof zPersonaUpdateBody>;

export const zPersonaTestBody = zPersonaUpdateBody.extend({
  samplePrompt: z.string().min(1).max(500).optional(),
});
export type PersonaTestBody = z.infer<typeof zPersonaTestBody>;

export const zPersonaTestResponse = z.object({
  previews: z.array(
    z.object({
      message: z.string().max(280),
      reason: z.string().max(140),
    }),
  ),
  degraded: z.boolean(),
});
export type PersonaTestResponse = z.infer<typeof zPersonaTestResponse>;

export const zPersonaMuteBody = z.object({
  duration: z.enum(['one_hour', 'eight_hours', 'until_unmuted', 'unmute']),
});
export type PersonaMuteBody = z.infer<typeof zPersonaMuteBody>;

export const zMemoryDTO = z.object({
  id: z.string(),
  kind: zMemoryKind,
  summary: z.string(),
  sensitivity: zSensitivity,
  confidence: z.number(),
  subjectUserIds: z.array(z.string()),
  lastConfirmedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type MemoryDTO = z.infer<typeof zMemoryDTO>;

export const zMemoryUpdateBody = z
  .object({
    summary: z.string().trim().min(1).max(280).optional(),
    kind: zMemoryKind.optional(),
    sensitivity: zSensitivity.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one memory field is required');
export type MemoryUpdateBody = z.infer<typeof zMemoryUpdateBody>;

export const zPersonaExplanationDTO = z.object({
  reason: z.string(),
  memories: z.array(z.object({ id: z.string(), summary: z.string() })),
});
export type PersonaExplanationDTO = z.infer<typeof zPersonaExplanationDTO>;

export const zAiImageCardDTO = z.object({
  mediaId: z.string(),
  imageUrl: z.string(),
  caption: z.string().nullable(),
  generator: z.string(),
});
export type AiImageCardDTO = z.infer<typeof zAiImageCardDTO>;
