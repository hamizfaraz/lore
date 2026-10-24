import {
  CANDIDATE_SOURCES,
  CATEGORIES,
  CREATED_BY,
  GROUP_PLAN_STATES,
  PREF_KEYS,
  PREF_SOURCES,
  PREF_VISIBILITIES,
  PROPOSAL_STATUSES,
  RSVP_STATUSES,
  VOTE_RESPONSES,
} from '@lore/shared/enums';
import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, primaryKey, real, text, uuid, vector } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from './columns';

/** plans.ts [C2] — preferences, triggers, candidates, proposals, votes, plans, RSVPs (plan section 5). */

export const groupPreferences = pgTable(
  'group_preferences',
  {
    id: id().primaryKey(),
    conversationId: uuid('conversation_id').notNull(),
    userId: uuid('user_id').notNull(),
    proposalId: uuid('proposal_id'),
    key: text('key', { enum: PREF_KEYS }).notNull(),
    value: jsonb('value').notNull(),
    source: text('source', { enum: PREF_SOURCES }).notNull().default('stated'),
    visibility: text('visibility', { enum: PREF_VISIBILITIES }).notNull().default('ai_only'),
    expiresAt: ts('expires_at'),
    createdAt: createdAt(),
  },
  (t) => [index('group_prefs_conv_idx').on(t.conversationId, t.userId)],
);

export const recommendationTriggers = pgTable('recommendation_triggers', {
  id: id().primaryKey(),
  conversationId: uuid('conversation_id').notNull(),
  kind: text('kind').notNull(),
  sourceMessageIds: uuid('source_message_ids').array().notNull().default(sql`'{}'::uuid[]`),
  confidence: real('confidence'),
  cooldownUntil: ts('cooldown_until'),
  createdAt: createdAt(),
});

export const candidates = pgTable('candidates', {
  id: id().primaryKey(),
  source: text('source', { enum: CANDIDATE_SOURCES }).notNull(),
  category: text('category', { enum: CATEGORIES }).notNull(),
  name: text('name').notNull(),
  url: text('url'),
  imageUrl: text('image_url'),
  address: text('address'),
  startsAt: ts('starts_at'),
  priceText: text('price_text'),
  rating: real('rating'),
  raw: jsonb('raw'),
  lastVerifiedAt: ts('last_verified_at'),
  dedupeKey: text('dedupe_key').notNull().unique(),
  embedding: vector('embedding', { dimensions: 768 }),
  createdAt: createdAt(),
});

export const planProposals = pgTable(
  'plan_proposals',
  {
    id: id().primaryKey(),
    conversationId: uuid('conversation_id').notNull(),
    triggerId: uuid('trigger_id'),
    messageId: uuid('message_id'),
    brief: jsonb('brief'),
    options: jsonb('options'),
    version: integer('version').notNull().default(1),
    status: text('status', { enum: PROPOSAL_STATUSES }).notNull().default('suggested'),
    decorativeMediaId: uuid('decorative_media_id'),
    createdBy: text('created_by', { enum: CREATED_BY }).notNull().default('ai'),
    createdByUserId: uuid('created_by_user_id'),
    createdAt: createdAt(),
  },
  (t) => [index('plan_proposals_conv_idx').on(t.conversationId)],
);

export const planVotes = pgTable(
  'plan_votes',
  {
    proposalId: uuid('proposal_id').notNull(),
    version: integer('version').notNull(),
    userId: uuid('user_id').notNull(),
    candidateId: uuid('candidate_id').notNull(),
    response: text('response', { enum: VOTE_RESPONSES }).notNull(),
    votedAt: ts('voted_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.proposalId, t.version, t.userId, t.candidateId] })],
);

export const groupPlans = pgTable('group_plans', {
  id: id().primaryKey(),
  proposalId: uuid('proposal_id').notNull(),
  conversationId: uuid('conversation_id').notNull(),
  candidateId: uuid('candidate_id').notNull(),
  title: text('title').notNull(),
  startsAt: ts('starts_at').notNull(),
  tz: text('tz').notNull(),
  regionLabel: text('region_label'),
  confirmedByUserId: uuid('confirmed_by_user_id').notNull(),
  state: text('state', { enum: GROUP_PLAN_STATES }).notNull().default('confirmed'),
  recapId: uuid('recap_id'),
  createdAt: createdAt(),
});

export const planRsvps = pgTable(
  'plan_rsvps',
  {
    planId: uuid('plan_id').notNull(),
    userId: uuid('user_id').notNull(),
    status: text('status', { enum: RSVP_STATUSES }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.planId, t.userId] })],
);
