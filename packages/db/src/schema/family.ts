import { FAMILY_STORY_STATES } from '@lore/shared/enums';
import type { FamilyStorySpec } from '@lore/shared/ai';
import { boolean, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from './columns';

/** family.ts [C2] — family stories and per-item contributions (plan section 5 / 8.10). */

export const familyStories = pgTable('family_stories', {
  id: id().primaryKey(),
  conversationId: uuid('conversation_id').notNull(),
  title: text('title').notNull(),
  periodLabel: text('period_label'),
  chapters: jsonb('chapters').$type<FamilyStorySpec['chapters']>(),
  coverMediaId: uuid('cover_media_id'),
  state: text('state', { enum: FAMILY_STORY_STATES }).notNull().default('source_selection'),
  flags: jsonb('flags').$type<FamilyStorySpec['flags']>(),
  createdAt: createdAt(),
});

export const familyStoryContributions = pgTable(
  'family_story_contributions',
  {
    storyId: uuid('story_id').notNull(),
    contributorUserId: uuid('contributor_user_id').notNull(),
    sourceMessageId: uuid('source_message_id').notNull(),
    include: boolean('include').notNull().default(true),
    correction: text('correction'),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.sourceMessageId] })],
);
