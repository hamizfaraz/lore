import { AUDIT_OUTCOMES } from '@lore/shared/enums';
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from './columns';

/** integrations.ts [C2] — PATs, agent audit, analytics hypertable, sync cursors (plan section 5). */

export const personalAccessTokens = pgTable(
  'personal_access_tokens',
  {
    id: id().primaryKey(),
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    scopes: text('scopes').array().notNull().default(sql`'{read}'::text[]`),
    lastUsedAt: ts('last_used_at'),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [index('pat_user_idx').on(t.userId)],
);

export const agentActionAudit = pgTable('agent_action_audit', {
  id: id().primaryKey(),
  at: ts('at').notNull().defaultNow(),
  userId: uuid('user_id').notNull(),
  tool: text('tool').notNull(),
  input: jsonb('input'),
  outcome: text('outcome', { enum: AUDIT_OUTCOMES }).notNull(),
  detail: text('detail'),
});

/** HYPERTABLE(at) — hashed ids only, no message text. */
export const analyticsEvents = pgTable('analytics_events', {
  eventId: text('event_id').notNull(),
  at: ts('at').notNull().defaultNow(),
  kind: text('kind').notNull(),
  groupHash: text('group_hash'),
  actorHash: text('actor_hash'),
  props: jsonb('props').$type<Record<string, unknown>>().notNull().default({}),
});

export const syncCursors = pgTable('sync_cursors', {
  name: text('name').primaryKey(),
  lastAt: ts('last_at'),
  lastEventId: text('last_event_id'),
});
