import { PODCAST_SHOW_STATES, STATION_STATES } from '@lore/shared/enums';
import { sql } from 'drizzle-orm';
import { date, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from './columns';

/** podcast.ts [C2] — shows, stations, voice contributions (plan section 5 / 8.12). */

export const podcastShows = pgTable('podcast_shows', {
  id: id().primaryKey(),
  conversationId: uuid('conversation_id').notNull(),
  title: text('title').notNull(),
  requiredParticipantIds: uuid('required_participant_ids').array().notNull().default(sql`'{}'::uuid[]`),
  state: text('state', { enum: PODCAST_SHOW_STATES }).notNull().default('collecting'),
  hostUserId: uuid('host_user_id').notNull(),
  wrappedAt: ts('wrapped_at'),
  renderMediaId: uuid('render_media_id'),
  createdAt: createdAt(),
});

export const podcastStations = pgTable('podcast_stations', {
  id: id().primaryKey(),
  showId: uuid('show_id').notNull(),
  parentStationId: uuid('parent_station_id'),
  topic: text('topic'),
  participantIds: uuid('participant_ids').array().notNull().default(sql`'{}'::uuid[]`),
  state: text('state', { enum: STATION_STATES }).notNull().default('open'),
  createdAt: createdAt(),
});

export const voiceContributions = pgTable(
  'voice_contributions',
  {
    id: id().primaryKey(),
    stationId: uuid('station_id').notNull(),
    userId: uuid('user_id').notNull(),
    mediaId: uuid('media_id').notNull(),
    replyToId: uuid('reply_to_id'),
    durationMs: integer('duration_ms').notNull(),
    day: date('day').notNull(),
    transcript: text('transcript'),
    createdAt: createdAt(),
  },
  (t) => [unique('voice_contrib_station_user_day_uq').on(t.stationId, t.userId, t.day)],
);
