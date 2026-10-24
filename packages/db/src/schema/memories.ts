import { EVENT_CANDIDATE_STATES, EVENT_KINDS, RECAP_LAYOUTS, RECAP_STATES } from '@lore/shared/enums';
import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, primaryKey, real, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from './columns';

/** memories.ts [C2] — event candidates, recaps, per-owner media consents (plan section 5). */

export const eventCandidates = pgTable('event_candidates', {
  id: id().primaryKey(),
  conversationId: uuid('conversation_id').notNull(),
  title: text('title').notNull(),
  kind: text('kind', { enum: EVENT_KINDS }).notNull().default('other'),
  startsAt: ts('starts_at'),
  endsAt: ts('ends_at'),
  confidence: real('confidence'),
  sourceMessageIds: uuid('source_message_ids').array().notNull().default(sql`'{}'::uuid[]`),
  planId: uuid('plan_id'),
  state: text('state', { enum: EVENT_CANDIDATE_STATES }).notNull().default('tentative'),
  createdAt: createdAt(),
});

export const recaps = pgTable('recaps', {
  id: id().primaryKey(),
  conversationId: uuid('conversation_id').notNull(),
  eventId: uuid('event_id'),
  planId: uuid('plan_id'),
  title: text('title').notNull(),
  caption: text('caption').notNull().default(''),
  layout: text('layout', { enum: RECAP_LAYOUTS }).notNull().default('collage'),
  mediaIds: uuid('media_ids').array().notNull().default(sql`'{}'::uuid[]`),
  coverMediaId: uuid('cover_media_id'),
  collageMediaId: uuid('collage_media_id'),
  musicLabel: text('music_label'),
  factsUsed: jsonb('facts_used').$type<{ claim: string; sourceMessageId: string }[]>(),
  state: text('state', { enum: RECAP_STATES }).notNull().default('candidate'),
  createdByAi: boolean('created_by_ai').notNull().default(true),
  createdAt: createdAt(),
});

export const recapMediaConsents = pgTable(
  'recap_media_consents',
  {
    recapId: uuid('recap_id').notNull(),
    mediaId: uuid('media_id').notNull(),
    ownerUserId: uuid('owner_user_id').notNull(),
    include: boolean('include').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.recapId, t.mediaId] })],
);
