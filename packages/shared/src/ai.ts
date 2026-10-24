import { z } from 'zod';
import { zCategory, zEventKind, zMemoryKind, zPrefKey, zSensitivity } from './enums';

/** Structured-output schemas shared by api and web (plan section 7). */

export const SPEAK_INTENTS = [
  'reply',
  'joke',
  'recall',
  'plan',
  'news',
  'recap_offer',
  'image_surprise',
  'support',
  'none',
] as const;
export const zSpeakIntent = z.enum(SPEAK_INTENTS);
export type SpeakIntent = z.infer<typeof zSpeakIntent>;

export const SpeakDecision = z.object({
  speak: z.boolean(),
  intent: zSpeakIntent,
  score: z.number().min(0).max(1),
  reason: z.string().max(140),
  message: z.string().max(280).optional(),
  memoryIdsUsed: z.array(z.string()),
  candidateId: z.string().optional(),
  planRequest: z.object({ categories: z.array(zCategory), whenText: z.string().optional() }).optional(),
  imagePrompt: z.string().optional(),
  newMemories: z.array(
    z.object({
      kind: zMemoryKind,
      summary: z.string(),
      subjectUserIds: z.array(z.string()),
      sensitivity: zSensitivity,
    }),
  ),
  events: z.array(
    z.object({
      title: z.string(),
      kind: zEventKind,
      whenText: z.string(),
      startsAt: z.string().optional(),
      confidence: z.number().min(0).max(1),
      sourceMessageIds: z.array(z.string()),
    }),
  ),
});
export type SpeakDecision = z.infer<typeof SpeakDecision>;

export const GroupIntentBrief = z.object({
  goal: z.string(),
  whenText: z.string(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  mode: z.enum(['in_person', 'remote', 'either']),
  categories: z.array(zCategory),
  hardConstraints: z.array(z.object({ userId: z.string().optional(), key: zPrefKey, value: z.unknown() })),
  softPreferences: z.array(
    z.object({ userId: z.string(), likes: z.array(z.string()), dislikes: z.array(z.string()) }),
  ),
  unknowns: z.array(z.object({ key: zPrefKey, question: z.string() })).max(1),
  searchQueries: z
    .array(z.object({ engine: z.enum(['events', 'maps', 'media', 'news']), q: z.string() }))
    .max(4),
});
export type GroupIntentBrief = z.infer<typeof GroupIntentBrief>;

export const zFit = z.enum(['great', 'ok', 'conflict']);
export const PlanRanking = z.object({
  options: z
    .array(
      z.object({
        candidateId: z.string(),
        headline: z.string(),
        why: z.string(),
        fitByMember: z.array(z.object({ userId: z.string(), fit: zFit, note: z.string() })),
        logistics: z.object({
          priceText: z.string().optional(),
          whenText: z.string().optional(),
          travelText: z.string().optional(),
        }),
      }),
    )
    .min(0)
    .max(4),
  compromiseNote: z.string().optional(),
  noFeasibleOption: z.boolean(),
  askToRelax: z.string().optional(),
});
export type PlanRanking = z.infer<typeof PlanRanking>;

export const PhotoNotes = z.object({
  mediaId: z.string(),
  caption: z.string(),
  people: z.number(),
  setting: z.string(),
  mood: z.string(),
  quality: z.number(),
});
export type PhotoNotes = z.infer<typeof PhotoNotes>;

export const RecapDraftSpec = z.object({
  title: z.string(),
  caption: z.string(),
  orderedMediaIds: z.array(z.string()),
  coverMediaId: z.string(),
  layout: z.enum(['collage', 'carousel', 'story']),
  coverPrompt: z.string(),
  musicVibe: z.string(),
  factsUsed: z.array(z.object({ claim: z.string(), sourceMessageId: z.string() })),
});
export type RecapDraftSpec = z.infer<typeof RecapDraftSpec>;

export const FiveWordChoices = z.object({
  words: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
  loreTag: z.string().optional(),
});
export type FiveWordChoices = z.infer<typeof FiveWordChoices>;

export const GamePrompt = z.object({
  prompt: z.string(),
  hint: z.string(),
  source: z.enum(['lore', 'random']),
  loreMemoryId: z.string().optional(),
});
export type GamePrompt = z.infer<typeof GamePrompt>;

export const MemeEntrySpec = z.object({ caption: z.string(), imagePrompt: z.string().optional() });
export type MemeEntrySpec = z.infer<typeof MemeEntrySpec>;

export const FamilyStorySpec = z.object({
  title: z.string(),
  periodLabel: z.string(),
  chapters: z.array(
    z.object({
      heading: z.string(),
      summary: z.string(),
      items: z.array(
        z.object({ sourceMessageId: z.string(), contributorUserId: z.string(), text: z.string() }),
      ),
    }),
  ),
  flags: z.array(
    z.object({
      sourceMessageId: z.string(),
      issue: z.enum(['date_unclear', 'unsupported_claim', 'sensitive']),
    }),
  ),
  coverPrompt: z.string(),
});
export type FamilyStorySpec = z.infer<typeof FamilyStorySpec>;

export const CommonGroundReason = z.object({
  sharedTags: z.array(z.string()),
  reason: z.string(),
  starter: z.string(),
  activityIdea: z.string().optional(),
});
export type CommonGroundReason = z.infer<typeof CommonGroundReason>;

export const GuardVerdict = z.object({
  allow: z.boolean(),
  category: z.enum(['ok', 'harassment', 'sexual', 'self_harm', 'hate', 'private_info', 'humiliation']),
  severity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});
export type GuardVerdict = z.infer<typeof GuardVerdict>;

/** Wrapper every AI adapter returns; `degraded` is true when the mock fallback was used (section 4). */
export type AiResult<T> = { data: T; degraded: boolean; model: string; latencyMs: number };
