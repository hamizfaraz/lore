import {
  ACCOUNT_TYPES,
  ENGAGEMENT_KINDS,
  FOLLOW_STATUSES,
  MEDIA_KINDS,
  POST_KINDS,
  POST_SOURCE_KINDS,
  TRANSCRIPT_STATUSES,
  VISIBILITIES,
} from '@lore/shared/enums';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { citext, createdAt, id, ts, tsvector } from './columns';

/** social.ts [C1] — Better Auth tables + social graph, media, posts, stories (plan section 5). */

// ── Better Auth (model names user/session/account/verification) ────────────────
export const user = pgTable('user', {
  id: id().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  /** guest accounts created by /join/[slug] expire automatically */
  guestExpiresAt: ts('guest_expires_at'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const session = pgTable(
  'session',
  {
    id: id().primaryKey(),
    expiresAt: ts('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: id().primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: ts('access_token_expires_at'),
    refreshTokenExpiresAt: ts('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = pgTable('verification', {
  id: id().primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

// ── Social ────────────────────────────────────────────────────────────────────
export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: id().primaryKey(),
    type: text('type', { enum: ACCOUNT_TYPES }).notNull(),
    handle: citext('handle').notNull(),
    displayName: text('display_name').notNull(),
    bio: text('bio'),
    avatarMediaId: uuid('avatar_media_id'),
    /** external avatar (e.g. Facebook picture) when no uploaded media */
    avatarUrl: text('avatar_url'),
    visibility: text('visibility', { enum: VISIBILITIES }).notNull().default('public'),
    ownerUserId: uuid('owner_user_id'),
    conversationId: uuid('conversation_id'),
    primaryAdminUserId: uuid('primary_admin_user_id'),
    /** group accounts the owner chose to show on their personal profile */
    showOnProfile: boolean('show_on_profile').notNull().default(true),
    onboardedAt: ts('onboarded_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('social_accounts_handle_uq').on(t.handle),
    index('social_accounts_owner_idx').on(t.ownerUserId),
    index('social_accounts_conv_idx').on(t.conversationId),
  ],
);

export const follows = pgTable(
  'follows',
  {
    followerAccountId: uuid('follower_account_id').notNull(),
    targetAccountId: uuid('target_account_id').notNull(),
    status: text('status', { enum: FOLLOW_STATUSES }).notNull().default('active'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerAccountId, t.targetAccountId] }),
    index('follows_target_idx').on(t.targetAccountId),
  ],
);

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: id().primaryKey(),
    ownerUserId: uuid('owner_user_id'),
    kind: text('kind', { enum: MEDIA_KINDS }).notNull(),
    storageKey: text('storage_key').notNull(),
    thumbKey: text('thumb_key'),
    mime: text('mime').notNull(),
    bytes: integer('bytes'),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    blurhash: text('blurhash'),
    aiGenerated: boolean('ai_generated').notNull().default(false),
    generator: text('generator'),
    transcript: text('transcript'),
    transcriptStatus: text('transcript_status', { enum: TRANSCRIPT_STATUSES }).notNull().default('none'),
    captionAi: text('caption_ai'),
    consentScope: jsonb('consent_scope').$type<Record<string, unknown>>(),
    /** set by POST /media/:id/complete */
    completedAt: ts('completed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('media_owner_idx').on(t.ownerUserId)],
);

export const posts = pgTable(
  'posts',
  {
    id: id().primaryKey(),
    authorAccountId: uuid('author_account_id').notNull(),
    createdByUserId: uuid('created_by_user_id'),
    kind: text('kind', { enum: POST_KINDS }).notNull(),
    caption: text('caption').notNull().default(''),
    altText: text('alt_text'),
    visibility: text('visibility', { enum: VISIBILITIES }).notNull().default('public'),
    locationLabel: text('location_label'),
    sourceKind: text('source_kind', { enum: POST_SOURCE_KINDS }).notNull().default('manual'),
    sourceId: uuid('source_id'),
    /** draft that produced this post (group accounts), for "Approved by N members" */
    draftId: uuid('draft_id'),
    topicTags: text('topic_tags').array().notNull().default(sql`'{}'::text[]`),
    likeCount: integer('like_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    publishedAt: ts('published_at').notNull().defaultNow(),
    deletedAt: ts('deleted_at'),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(sql`to_tsvector('simple', coalesce(caption, ''))`),
  },
  (t) => [index('posts_author_published_idx').on(t.authorAccountId, t.publishedAt.desc())],
);

export const postMedia = pgTable(
  'post_media',
  {
    postId: uuid('post_id').notNull(),
    mediaId: uuid('media_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    altText: text('alt_text'),
  },
  (t) => [primaryKey({ columns: [t.postId, t.mediaId] })],
);

/** like/save state per user (engagement_events keeps the time-series history). */
export const postLikes = pgTable(
  'post_likes',
  {
    postId: uuid('post_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export const postSaves = pgTable(
  'post_saves',
  {
    postId: uuid('post_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export const stories = pgTable(
  'stories',
  {
    id: id().primaryKey(),
    authorAccountId: uuid('author_account_id').notNull(),
    createdByUserId: uuid('created_by_user_id'),
    mediaId: uuid('media_id').notNull(),
    caption: text('caption'),
    createdAt: createdAt(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('stories_author_idx').on(t.authorAccountId, t.expiresAt)],
);

export const storyViews = pgTable(
  'story_views',
  {
    storyId: uuid('story_id').notNull(),
    viewerUserId: uuid('viewer_user_id').notNull(),
    viewedAt: ts('viewed_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.viewerUserId] })],
);

export const comments = pgTable(
  'comments',
  {
    id: id().primaryKey(),
    postId: uuid('post_id').notNull(),
    authorAccountId: uuid('author_account_id').notNull(),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('comments_post_idx').on(t.postId, t.createdAt)],
);

/** HYPERTABLE(at) — see sql/002_hypertables.sql. No PK, no FKs into it. */
export const engagementEvents = pgTable(
  'engagement_events',
  {
    at: ts('at').notNull().defaultNow(),
    actorUserId: uuid('actor_user_id').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    kind: text('kind', { enum: ENGAGEMENT_KINDS }).notNull(),
    topicTags: text('topic_tags').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [index('engagement_actor_idx').on(t.actorUserId, t.at.desc())],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id().primaryKey(),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt.desc())],
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: id().primaryKey(),
    userId: uuid('user_id').notNull(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('push_endpoint_uq').on(t.endpoint)],
);

export const facebookImports = pgTable('facebook_imports', {
  userId: uuid('user_id').primaryKey(),
  fbUserId: text('fb_user_id').notNull(),
  grantedScopes: text('granted_scopes').array().notNull().default(sql`'{}'::text[]`),
  likes: jsonb('likes').$type<{ id: string; name: string; category: string }[]>(),
  friendFbIds: text('friend_fb_ids').array().notNull().default(sql`'{}'::text[]`),
  importedAt: ts('imported_at'),
});

export const keepsakes = pgTable(
  'keepsakes',
  {
    id: id().primaryKey(),
    recapId: uuid('recap_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    mintAddress: text('mint_address'),
    txSignature: text('tx_signature'),
    network: text('network').notNull().default('devnet'),
    status: text('status', { enum: ['pending', 'minted', 'failed'] as const })
      .notNull()
      .default('pending'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('keepsakes_recap_uq').on(t.recapId)],
);

/** per-user devnet keypair generated at signup (keepsake member list). */
export const userWallets = pgTable('user_wallets', {
  userId: uuid('user_id').primaryKey(),
  pubkey: text('pubkey').notNull(),
  createdAt: createdAt(),
});
