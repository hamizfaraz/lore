import { CONTEXT_SOURCES, GAME_MODES, GAME_STATES, MEME_CREATOR_TYPES } from '@lore/shared/enums';
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from './columns';

/** games.ts [C1] — game sessions, participants, turns, meme entries/votes (plan section 5 / 8.5). */

export type GameConfigRow = {
  rounds: number;
  timerSec: number;
  contextSource: (typeof CONTEXT_SOURCES)[number];
  teams: boolean;
  allowSelfVote: boolean;
  maxWords: number;
  aiCompetitor?: boolean;
};

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: id().primaryKey(),
    conversationId: uuid('conversation_id').notNull(),
    mode: text('mode', { enum: GAME_MODES }).notNull(),
    state: text('state', { enum: GAME_STATES }).notNull().default('lobby'),
    config: jsonb('config').$type<GameConfigRow>().notNull(),
    currentRound: integer('current_round').notNull().default(0),
    hostUserId: uuid('host_user_id').notNull(),
    result: jsonb('result').$type<Record<string, unknown>>(),
    resultMediaId: uuid('result_media_id'),
    lastActionAt: ts('last_action_at').notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index('games_conv_idx').on(t.conversationId, t.state)],
);

export const gameParticipants = pgTable(
  'game_participants',
  {
    sessionId: uuid('session_id').notNull(),
    userId: uuid('user_id').notNull(),
    team: text('team'),
    score: integer('score').notNull().default(0),
    ready: boolean('ready').notNull().default(false),
    joinedAt: ts('joined_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);

export const gameTurns = pgTable(
  'game_turns',
  {
    id: id().primaryKey(),
    sessionId: uuid('session_id').notNull(),
    round: integer('round').notNull(),
    activeUserId: uuid('active_user_id'),
    prompt: jsonb('prompt').$type<Record<string, unknown>>(),
    choices: text('choices').array().notNull().default(sql`'{}'::text[]`),
    answer: text('answer'),
    completedAt: ts('completed_at'),
  },
  (t) => [index('game_turns_session_idx').on(t.sessionId, t.round)],
);

export const memeEntries = pgTable('meme_entries', {
  id: id().primaryKey(),
  sessionId: uuid('session_id').notNull(),
  round: integer('round').notNull(),
  creatorType: text('creator_type', { enum: MEME_CREATOR_TYPES }).notNull(),
  creatorUserId: uuid('creator_user_id'),
  imageMediaId: uuid('image_media_id'),
  caption: text('caption').notNull(),
  anonSlot: integer('anon_slot').notNull(),
});

export const memeVotes = pgTable(
  'meme_votes',
  {
    sessionId: uuid('session_id').notNull(),
    round: integer('round').notNull(),
    voterUserId: uuid('voter_user_id').notNull(),
    entryId: uuid('entry_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.round, t.voterUserId] })],
);
