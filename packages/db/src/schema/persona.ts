import { DECISION_TRIGGERS, INITIATIVES, MEMORY_KINDS, SENSITIVITIES } from '@lore/shared/enums';
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, real, text, uuid, vector } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from './columns';

/** persona.ts [C2] — AI personas, memories (vector), decisions hypertable (plan section 5). */

export const aiPersonas = pgTable('ai_personas', {
  id: id().primaryKey(),
  conversationId: uuid('conversation_id').notNull().unique(),
  name: text('name').notNull(),
  avatarMediaId: uuid('avatar_media_id'),
  tone: text('tone').array().notNull().default(sql`'{}'::text[]`),
  interests: text('interests').array().notNull().default(sql`'{}'::text[]`),
  boundaries: text('boundaries'),
  initiative: text('initiative', { enum: INITIATIVES }).notNull().default('balanced'),
  quietHours: jsonb('quiet_hours').$type<{ start: string; end: string; tz: string }>(),
  allowHistory: boolean('allow_history').notNull().default(true),
  allowNews: boolean('allow_news').notNull().default(true),
  allowImages: boolean('allow_images').notNull().default(true),
  allowPlans: boolean('allow_plans').notNull().default(true),
  allowLocation: boolean('allow_location').notNull().default(false),
  surpriseImagesPerWeek: integer('surprise_images_per_week').notNull().default(1),
  enabled: boolean('enabled').notNull().default(true),
  mutedUntil: ts('muted_until'),
  createdByUserId: uuid('created_by_user_id'),
  createdAt: createdAt(),
});

export const aiMemories = pgTable(
  'ai_memories',
  {
    id: id().primaryKey(),
    conversationId: uuid('conversation_id').notNull(),
    kind: text('kind', { enum: MEMORY_KINDS }).notNull(),
    summary: text('summary').notNull(),
    sourceMessageIds: uuid('source_message_ids').array().notNull().default(sql`'{}'::uuid[]`),
    subjectUserIds: uuid('subject_user_ids').array().notNull().default(sql`'{}'::uuid[]`),
    sensitivity: text('sensitivity', { enum: SENSITIVITIES }).notNull().default('low'),
    confidence: real('confidence').notNull().default(0.7),
    lastConfirmedAt: ts('last_confirmed_at'),
    expiresAt: ts('expires_at'),
    embedding: vector('embedding', { dimensions: 768 }),
    deletedAt: ts('deleted_at'),
    createdAt: createdAt(),
  },
  (t) => [index('ai_memories_conv_idx').on(t.conversationId)],
);

/** HYPERTABLE(at) */
export const aiDecisions = pgTable(
  'ai_decisions',
  {
    at: ts('at').notNull().defaultNow(),
    conversationId: uuid('conversation_id').notNull(),
    trigger: text('trigger', { enum: DECISION_TRIGGERS }).notNull(),
    speak: boolean('speak').notNull(),
    intent: text('intent'),
    score: real('score'),
    reason: text('reason'),
    model: text('model'),
    latencyMs: integer('latency_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
  },
  (t) => [index('ai_decisions_conv_idx').on(t.conversationId, t.at.desc())],
);
