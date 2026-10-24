import { CONVERSATION_KINDS, MEMBER_ROLES, MESSAGE_KINDS, MUTE_SCOPES, SENDER_TYPES } from '@lore/shared/enums';
import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from './columns';

/** chat.ts [C1] — conversations, members, messages hypertable, reactions (plan section 5). */

export const conversations = pgTable('conversations', {
  id: id().primaryKey(),
  kind: text('kind', { enum: CONVERSATION_KINDS }).notNull(),
  title: text('title'),
  avatarMediaId: uuid('avatar_media_id'),
  createdByUserId: uuid('created_by_user_id'),
  groupAccountId: uuid('group_account_id'),
  /** guest-join slug for judges (/join/[slug]) */
  joinSlug: text('join_slug').unique(),
  joinCode: text('join_code'),
  lastMessageAt: ts('last_message_at'),
  createdAt: createdAt(),
});

export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: uuid('conversation_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: text('role', { enum: MEMBER_ROLES }).notNull().default('member'),
    muteScope: text('mute_scope', { enum: MUTE_SCOPES }),
    muteUntil: ts('mute_until'),
    aiHistoryConsent: boolean('ai_history_consent').notNull().default(true),
    lastReadAt: ts('last_read_at'),
    pinnedAt: ts('pinned_at'),
    joinedAt: ts('joined_at').notNull().defaultNow(),
    /** soft removal keeps history attribution; removed members get 403 */
    removedAt: ts('removed_at'),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index('conv_members_user_idx').on(t.userId)],
);

/** HYPERTABLE(created_at, 7-day chunks), PK(id, created_at). No FKs into it. */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    senderType: text('sender_type', { enum: SENDER_TYPES }).notNull(),
    senderUserId: uuid('sender_user_id'),
    personaId: uuid('persona_id'),
    clientId: text('client_id'),
    kind: text('kind', { enum: MESSAGE_KINDS }).notNull(),
    body: text('body'),
    mediaIds: uuid('media_ids').array().notNull().default(sql`'{}'::uuid[]`),
    cardKind: text('card_kind'),
    cardRefId: uuid('card_ref_id'),
    replyToId: uuid('reply_to_id'),
    aiGenerated: boolean('ai_generated').notNull().default(false),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    editedAt: ts('edited_at'),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.createdAt] }),
    index('messages_conv_created_idx').on(t.conversationId, t.createdAt.desc()),
    // idempotent sends are enforced in chat.service (Valkey key + lookup); hypertable unique
    // indexes must include created_at, so this is a plain index.
    index('messages_client_idx').on(t.conversationId, t.clientId),
  ],
);

export const messageReactions = pgTable(
  'message_reactions',
  {
    messageId: uuid('message_id').notNull(),
    userId: uuid('user_id').notNull(),
    emoji: text('emoji').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })],
);
