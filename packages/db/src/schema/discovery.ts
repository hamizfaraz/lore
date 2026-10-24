import { INTRO_STATES } from '@lore/shared/enums';
import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, primaryKey, text, uuid, vector } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from './columns';

/** discovery.ts [C2] — interest profiles (vector), quiz answers, introductions (plan section 5 / 8.11). */

export const interestProfiles = pgTable('interest_profiles', {
  userId: uuid('user_id').primaryKey(),
  explicitTags: text('explicit_tags').array().notNull().default(sql`'{}'::text[]`),
  inferred: jsonb('inferred').$type<Record<string, number>>().notNull().default({}),
  frozen: boolean('frozen').notNull().default(false),
  discoverable: boolean('discoverable').notNull().default(false),
  bioSnippet: text('bio_snippet'),
  embedding: vector('embedding', { dimensions: 768 }),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const quizAnswers = pgTable(
  'quiz_answers',
  {
    userId: uuid('user_id').notNull(),
    questionId: text('question_id').notNull(),
    answer: jsonb('answer').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questionId] })],
);

export const introductions = pgTable('introductions', {
  id: id().primaryKey(),
  fromUserId: uuid('from_user_id').notNull(),
  toUserId: uuid('to_user_id').notNull(),
  basis: jsonb('basis').$type<{ sharedTags: string[]; reason: string }>().notNull(),
  firstMessage: text('first_message'),
  state: text('state', { enum: INTRO_STATES }).notNull().default('requested'),
  createdAt: createdAt(),
});
