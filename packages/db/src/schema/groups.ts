import {
  ACTOR_TYPES,
  APPROVAL_DECISIONS,
  DRAFT_STATES,
  POLICY_MODES,
  POST_KINDS,
  POST_SOURCE_KINDS,
} from '@lore/shared/enums';
import type { PolicySnapshot } from '@lore/shared/policy';
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from './columns';

/** groups.ts [C1] — publishing policies, drafts, approvals, audit log (plan section 5 / 8.4). */

export const publishingPolicies = pgTable('publishing_policies', {
  accountId: uuid('account_id').primaryKey(),
  mode: text('mode', { enum: POLICY_MODES }).notNull().default('threshold'),
  threshold: integer('threshold'),
  eligibleRoles: text('eligible_roles')
    .array()
    .notNull()
    .default(sql`'{primary_admin,admin,publisher,member}'::text[]`),
  storyMode: text('story_mode', { enum: POLICY_MODES }),
  updatedBy: uuid('updated_by'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const postDrafts = pgTable(
  'post_drafts',
  {
    id: id().primaryKey(),
    accountId: uuid('account_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    createdByUserId: uuid('created_by_user_id'),
    createdByAi: boolean('created_by_ai').notNull().default(false),
    kind: text('kind', { enum: POST_KINDS }).notNull(),
    caption: text('caption').notNull().default(''),
    mediaIds: uuid('media_ids').array().notNull().default(sql`'{}'::uuid[]`),
    audioLabel: text('audio_label'),
    version: integer('version').notNull().default(1),
    contentHash: text('content_hash').notNull(),
    state: text('state', { enum: DRAFT_STATES }).notNull().default('editing'),
    policySnapshot: jsonb('policy_snapshot').$type<PolicySnapshot>(),
    sourceKind: text('source_kind', { enum: POST_SOURCE_KINDS }).notNull().default('manual'),
    sourceId: uuid('source_id'),
    /** chat message carrying the draft_card */
    messageId: uuid('message_id'),
    publishedPostId: uuid('published_post_id'),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('drafts_account_idx').on(t.accountId, t.state),
    index('drafts_conv_idx').on(t.conversationId),
  ],
);

export const approvals = pgTable(
  'approvals',
  {
    draftId: uuid('draft_id').notNull(),
    version: integer('version').notNull(),
    userId: uuid('user_id').notNull(),
    decision: text('decision', { enum: APPROVAL_DECISIONS }).notNull(),
    note: text('note'),
    decidedAt: ts('decided_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.draftId, t.version, t.userId] })],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: id().primaryKey(),
    at: ts('at').notNull().defaultNow(),
    actorType: text('actor_type', { enum: ACTOR_TYPES }).notNull(),
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id'),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('audit_target_idx').on(t.targetType, t.targetId)],
);
