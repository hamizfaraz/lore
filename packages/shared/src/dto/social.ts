import { z } from 'zod';
import { zPostKind, zPostSourceKind, zVisibility } from '../enums';
import { zMediaDTO } from './media';
import { zAccountSummary } from './users';

export const zPostDTO = z.object({
  id: z.string(),
  author: zAccountSummary,
  kind: zPostKind,
  caption: z.string(),
  altText: z.string().nullable(),
  locationLabel: z.string().nullable(),
  media: z.array(zMediaDTO),
  likeCount: z.number(),
  commentCount: z.number(),
  likedByMe: z.boolean(),
  savedByMe: z.boolean(),
  likedBy: z.array(z.string()),
  sourceKind: zPostSourceKind,
  approvedByCount: z.number().nullable(),
  publishedAt: z.string(),
});
export type PostDTO = z.infer<typeof zPostDTO>;

export const zCreatePostBody = z.object({
  authorAccountId: z.string(),
  kind: zPostKind,
  caption: z.string().max(2200).default(''),
  altText: z.string().max(500).optional(),
  locationLabel: z.string().max(80).optional(),
  mediaIds: z.array(z.string()).min(1).max(10),
  visibility: zVisibility.optional(),
  /** courtesy mode: author chooses to send for review */
  requestReview: z.boolean().optional(),
});
export type CreatePostBody = z.infer<typeof zCreatePostBody>;

/** POST /posts returns either a published post or a group draft (server decides by policy). */
export const zCreatePostResult = z.discriminatedUnion('type', [
  z.object({ type: z.literal('post'), post: zPostDTO }),
  z.object({ type: z.literal('draft'), draftId: z.string() }),
]);
export type CreatePostResult = z.infer<typeof zCreatePostResult>;

export const zCommentDTO = z.object({
  id: z.string(),
  postId: z.string(),
  author: zAccountSummary,
  body: z.string(),
  createdAt: z.string(),
});
export type CommentDTO = z.infer<typeof zCommentDTO>;
export const zCreateCommentBody = z.object({ body: z.string().min(1).max(2200) });

export const zStoryDTO = z.object({
  id: z.string(),
  media: zMediaDTO,
  caption: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  seen: z.boolean(),
});
export type StoryDTO = z.infer<typeof zStoryDTO>;

export const zStoryRailItem = z.object({
  author: zAccountSummary,
  stories: z.array(zStoryDTO),
  allSeen: z.boolean(),
  isGroup: z.boolean(),
});
export type StoryRailItemDTO = z.infer<typeof zStoryRailItem>;

export const zCreateStoryBody = z.object({
  authorAccountId: z.string(),
  mediaId: z.string(),
  caption: z.string().max(200).optional(),
});
export type CreateStoryBody = z.infer<typeof zCreateStoryBody>;

export const zExploreResult = z.object({
  accounts: z.array(zAccountSummary),
  posts: z.array(zPostDTO),
  nextCursor: z.string().nullable(),
});
export type ExploreResultDTO = z.infer<typeof zExploreResult>;
