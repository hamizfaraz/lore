import { and, desc, eq, gt, inArray, isNull, lt, notInArray, or, sql } from '@lore/db';
import {
  approvals,
  comments,
  conversationMembers,
  engagementEvents,
  follows,
  postDrafts,
  postLikes,
  postMedia,
  postSaves,
  postTags,
  posts,
  socialAccounts,
  stories,
  storyViews,
} from '@lore/db';
import type {
  CommentDTO,
  CreatePostBody,
  PostDTO,
  StoryDTO,
  StoryRailItemDTO,
} from '@lore/shared/dto/social';
import type { ProfileDTO } from '@lore/shared/dto/users';
import type { EngagementKind, PostKind, PostSourceKind, Visibility } from '@lore/shared/enums';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../../lib/db';
import { env } from '../../lib/env';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import * as media from '../media/service';
import { assertNotBlocked, blockedAccountIds } from './blocks';
import * as notifications from '../notifications/service';
import * as users from '../users/service';

/** social business logic [C1]: profiles, follows, posts, feed, likes, saves, comments, stories (section 8.1). */

type AccountRow = typeof socialAccounts.$inferSelect;
type PostRow = typeof posts.$inferSelect;

// ── cursor helpers ────────────────────────────────────────────────────────────
export const encodeCursor = (at: Date, id: string) =>
  Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');
export function decodeCursor(c?: string | null): { at: Date; id: string } | null {
  if (!c) return null;
  try {
    const [iso, id] = Buffer.from(c, 'base64url').toString().split('|');
    return { at: new Date(iso), id };
  } catch {
    return null;
  }
}

// ── viewer context & visibility ────────────────────────────────────────────────
export type Viewer = {
  userId: string;
  accountId: string;
  following: Set<string>;
  pending: Set<string>;
  groupAccountIds: Set<string>;
  blockedAccountIds: Set<string>;
};

export async function viewer(userId: string): Promise<Viewer> {
  const acct = await users.requirePersonalAccount(userId);
  const db = getDb();
  const [f, g] = await Promise.all([
    db
      .select({ t: follows.targetAccountId, s: follows.status })
      .from(follows)
      .where(eq(follows.followerAccountId, acct.id)),
    db
      .select({ id: socialAccounts.id })
      .from(socialAccounts)
      .innerJoin(
        conversationMembers,
        and(
          eq(conversationMembers.conversationId, socialAccounts.conversationId),
          eq(conversationMembers.userId, userId),
          isNull(conversationMembers.removedAt),
        ),
      )
      .where(eq(socialAccounts.type, 'group')),
  ]);
  return {
    userId,
    accountId: acct.id,
    following: new Set(f.filter((x) => x.s === 'active').map((x) => x.t)),
    pending: new Set(f.filter((x) => x.s === 'pending').map((x) => x.t)),
    groupAccountIds: new Set(g.map((x) => x.id)),
    blockedAccountIds: await blockedAccountIds(userId),
  };
}

export function canSeeAccount(a: Pick<AccountRow, 'id' | 'visibility'>, v: Viewer | null): boolean {
  if (a.visibility === 'public') return true;
  if (!v) return false;
  return v.accountId === a.id || v.following.has(a.id) || v.groupAccountIds.has(a.id);
}

async function accountByHandle(handle: string) {
  const [a] = await getDb()
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.handle, handle.toLowerCase()))
    .limit(1);
  return a ?? null;
}
export async function accountById(id: string) {
  const [a] = await getDb().select().from(socialAccounts).where(eq(socialAccounts.id, id)).limit(1);
  return a ?? null;
}

// ── profiles ────────────────────────────────────────────────────────────────────
export async function getProfile(handle: string, viewerUserId: string): Promise<ProfileDTO> {
  const a = await accountByHandle(handle);
  if (!a) throw notFound('Profile not found');
  const v = await viewer(viewerUserId);
  const db = getDb();
  const [[pc], [fc], [gc], summary] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.authorAccountId, a.id), isNull(posts.deletedAt))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(follows)
      .where(and(eq(follows.targetAccountId, a.id), eq(follows.status, 'active'))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(follows)
      .where(and(eq(follows.followerAccountId, a.id), eq(follows.status, 'active'))),
    users.accountSummary(a.id),
  ]);
  const isMember = a.type === 'group' && v.groupAccountIds.has(a.id);
  let members: ProfileDTO['members'];
  let publicGroups: ProfileDTO['publicGroups'];
  if (a.type === 'group' && a.conversationId) {
    const m = await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(eq(conversationMembers.conversationId, a.conversationId), isNull(conversationMembers.removedAt)),
      );
    const accts = await users.personalAccountsByUser(m.map((x) => x.userId));
    members = [...(await users.accountSummaries([...accts.values()].map((x) => x.id))).values()];
  }
  if (a.type === 'personal' && a.ownerUserId) {
    const groups = await db
      .select({ id: socialAccounts.id })
      .from(socialAccounts)
      .innerJoin(
        conversationMembers,
        and(
          eq(conversationMembers.conversationId, socialAccounts.conversationId),
          eq(conversationMembers.userId, a.ownerUserId),
          isNull(conversationMembers.removedAt),
        ),
      )
      .where(and(eq(socialAccounts.type, 'group'), eq(socialAccounts.showOnProfile, true)));
    const s = await users.accountSummaries(groups.map((g) => g.id));
    publicGroups = [...s.values()].filter((g) => g.visibility === 'public' || v.groupAccountIds.has(g.id));
  }
  return {
    ...summary!,
    bio: a.bio,
    counts: { posts: pc.n, followers: fc.n, following: gc.n },
    viewer: {
      isSelf: v.accountId === a.id,
      following: v.following.has(a.id),
      pending: v.pending.has(a.id),
      canSeePosts: canSeeAccount(a, v) && !v.blockedAccountIds.has(a.id),
      isMember,
      blocked: v.blockedAccountIds.has(a.id),
    },
    members,
    publicGroups,
  };
}

// ── follow ────────────────────────────────────────────────────────────────────────
export async function follow(viewerUserId: string, targetAccountId: string) {
  const v = await viewer(viewerUserId);
  const target = await accountById(targetAccountId);
  if (!target) throw notFound();
  if (target.id === v.accountId) throw badRequest("You can't follow yourself");
  if (target.ownerUserId) await assertNotBlocked(viewerUserId, target.ownerUserId);
  const status = target.visibility === 'private' && !v.groupAccountIds.has(target.id) ? 'pending' : 'active';
  await getDb()
    .insert(follows)
    .values({ followerAccountId: v.accountId, targetAccountId: target.id, status })
    .onConflictDoNothing();
  const me = await users.accountSummary(v.accountId);
  const recipients = target.type === 'personal' ? [target.ownerUserId!] : [];
  for (const uid of recipients) {
    void notifications.notify(
      uid,
      status === 'pending' ? 'follow_request' : 'follow',
      {
        actorName: me?.displayName,
        actorHandle: me?.handle,
        actorAvatarUrl: me?.avatarUrl,
        text: status === 'pending' ? 'requested to follow you.' : 'started following you.',
        href: `/u/${me?.handle}`,
        accountId: v.accountId,
      },
      { dedupeKey: `follow:${v.accountId}` },
    );
  }
  void signal(viewerUserId, [], 'follow');
  return { status };
}

export async function unfollow(viewerUserId: string, targetAccountId: string) {
  const v = await viewer(viewerUserId);
  await getDb()
    .delete(follows)
    .where(and(eq(follows.followerAccountId, v.accountId), eq(follows.targetAccountId, targetAccountId)));
  return { status: 'none' as const };
}

export async function approveFollow(ownerUserId: string, followerAccountId: string) {
  const acct = await users.requirePersonalAccount(ownerUserId);
  await getDb()
    .update(follows)
    .set({ status: 'active' })
    .where(and(eq(follows.followerAccountId, followerAccountId), eq(follows.targetAccountId, acct.id)));
}

// ── posts ─────────────────────────────────────────────────────────────────────────
export async function postDTOs(rows: PostRow[], viewerUserId: string): Promise<PostDTO[]> {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const [pm, liked, saved, likers, approvalsRows, authors] = await Promise.all([
    db.select().from(postMedia).where(inArray(postMedia.postId, ids)).orderBy(postMedia.sortOrder),
    db
      .select({ p: postLikes.postId })
      .from(postLikes)
      .where(and(inArray(postLikes.postId, ids), eq(postLikes.userId, viewerUserId))),
    db
      .select({ p: postSaves.postId })
      .from(postSaves)
      .where(and(inArray(postSaves.postId, ids), eq(postSaves.userId, viewerUserId))),
    db
      .select({ p: postLikes.postId, handle: socialAccounts.handle })
      .from(postLikes)
      .innerJoin(
        socialAccounts,
        and(eq(socialAccounts.ownerUserId, postLikes.userId), eq(socialAccounts.type, 'personal')),
      )
      .where(inArray(postLikes.postId, ids))
      .orderBy(desc(postLikes.createdAt))
      .limit(200),
    (async () => {
      const draftIds = rows.map((r) => r.draftId).filter(Boolean) as string[];
      if (!draftIds.length) return [] as { d: string; n: number }[];
      return db
        .select({ d: approvals.draftId, n: sql<number>`count(*)::int` })
        .from(approvals)
        .innerJoin(
          postDrafts,
          and(eq(postDrafts.id, approvals.draftId), eq(postDrafts.version, approvals.version)),
        )
        .where(and(inArray(approvals.draftId, draftIds), eq(approvals.decision, 'approve')))
        .groupBy(approvals.draftId);
    })(),
    users.accountSummaries(rows.map((r) => r.authorAccountId)),
  ]);
  const mediaByPost = new Map<string, { id: string; alt: string | null }[]>();
  for (const m of pm)
    mediaByPost.set(m.postId, [...(mediaByPost.get(m.postId) ?? []), { id: m.mediaId, alt: m.altText }]);
  const allMediaIds = pm.map((m) => m.mediaId);
  const altMap = new Map(pm.map((m) => [m.mediaId, m.altText]));
  const mediaList = await media.mediaDTOs(allMediaIds, altMap);
  const mediaById = new Map(mediaList.map((m) => [m.id, m]));
  const likedSet = new Set(liked.map((x) => x.p));
  const savedSet = new Set(saved.map((x) => x.p));
  const approvedBy = new Map(approvalsRows.map((x) => [x.d, x.n]));
  return rows.map((r) => ({
    id: r.id,
    author: authors.get(r.authorAccountId)!,
    kind: r.kind,
    caption: r.caption,
    altText: r.altText,
    locationLabel: r.locationLabel,
    media: (mediaByPost.get(r.id) ?? []).map((m) => mediaById.get(m.id)).filter(Boolean) as PostDTO['media'],
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    likedByMe: likedSet.has(r.id),
    savedByMe: savedSet.has(r.id),
    likedBy: likers
      .filter((l) => l.p === r.id)
      .map((l) => l.handle)
      .slice(0, 1),
    sourceKind: r.sourceKind,
    approvedByCount: r.draftId ? (approvedBy.get(r.draftId) ?? null) : null,
    publishedAt: r.publishedAt.toISOString(),
  }));
}

export async function getPost(id: string, viewerUserId: string): Promise<PostDTO> {
  const [row] = await getDb()
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .limit(1);
  if (!row) throw notFound('Post not found');
  const author = await accountById(row.authorAccountId);
  if (!author || !canSeeAccount(author, await viewer(viewerUserId)))
    throw forbidden('This account is private');
  return (await postDTOs([row], viewerUserId))[0];
}

const PAGE = 10;

/** Home feed: posts from followed accounts + own + group accounts I'm in, newest first, 10 per page. */
export async function feed(userId: string, cursor?: string) {
  const v = await viewer(userId);
  const authorIds = [...new Set([v.accountId, ...v.following, ...v.groupAccountIds])].filter(
    (id) => !v.blockedAccountIds.has(id),
  );
  const c = decodeCursor(cursor);
  const rows = authorIds.length
    ? await getDb()
        .select()
        .from(posts)
        .where(
          and(
            inArray(posts.authorAccountId, authorIds),
            isNull(posts.deletedAt),
            c
              ? or(lt(posts.publishedAt, c.at), and(eq(posts.publishedAt, c.at), lt(posts.id, c.id)))
              : undefined,
          ),
        )
        .orderBy(desc(posts.publishedAt), desc(posts.id))
        .limit(PAGE + 1)
    : [];
  const page = rows.slice(0, PAGE);
  return {
    items: await postDTOs(page, userId),
    nextCursor:
      rows.length > PAGE ? encodeCursor(page[page.length - 1].publishedAt, page[page.length - 1].id) : null,
  };
}

export async function accountPosts(
  accountId: string,
  tab: 'posts' | 'reels' | 'tagged',
  userId: string,
  cursor?: string,
) {
  const a = await accountById(accountId);
  if (!a) throw notFound();
  const v = await viewer(userId);
  if (!canSeeAccount(a, v)) return { items: [], nextCursor: null };
  if (tab === 'tagged') return taggedPosts(a, v, userId, cursor);
  const c = decodeCursor(cursor);
  const rows = await getDb()
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.authorAccountId, accountId),
        isNull(posts.deletedAt),
        tab === 'reels' ? eq(posts.kind, 'reel') : undefined,
        c ? or(lt(posts.publishedAt, c.at), and(eq(posts.publishedAt, c.at), lt(posts.id, c.id))) : undefined,
      ),
    )
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(31);
  const page = rows.slice(0, 30);
  return {
    items: await postDTOs(page, userId),
    nextCursor: rows.length > 30 ? encodeCursor(page[29].publishedAt, page[29].id) : null,
  };
}

async function taggedPosts(account: AccountRow, v: Viewer, userId: string, cursor?: string) {
  if (!account.ownerUserId) return { items: [], nextCursor: null };
  const c = decodeCursor(cursor);
  const rows = await getDb()
    .select({ post: posts })
    .from(postTags)
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .where(
      and(
        eq(postTags.taggedUserId, account.ownerUserId),
        isNull(posts.deletedAt),
        c ? or(lt(posts.publishedAt, c.at), and(eq(posts.publishedAt, c.at), lt(posts.id, c.id))) : undefined,
      ),
    )
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(31);
  const visible = [];
  for (const row of rows) {
    const author = await accountById(row.post.authorAccountId);
    if (author && canSeeAccount(author, v) && !v.blockedAccountIds.has(author.id)) visible.push(row.post);
  }
  const page = visible.slice(0, 30);
  return {
    items: await postDTOs(page, userId),
    nextCursor: visible.length > 30 ? encodeCursor(page[29].publishedAt, page[29].id) : null,
  };
}

async function tagPeople(postId: string, actorUserId: string, handles: string[] | undefined) {
  const clean = [...new Set((handles ?? []).map((handle) => handle.trim().toLowerCase()).filter(Boolean))];
  if (!clean.length) return;
  const accounts = await getDb().select().from(socialAccounts).where(inArray(socialAccounts.handle, clean));
  const ids = accounts.map((account) => account.ownerUserId).filter((id): id is string => Boolean(id));
  if (!ids.length) return;
  await getDb()
    .insert(postTags)
    .values(ids.map((taggedUserId) => ({ postId, taggedUserId, taggedByUserId: actorUserId })))
    .onConflictDoNothing();
  const actor = await users.accountSummary((await users.requirePersonalAccount(actorUserId)).id);
  for (const taggedUserId of ids) {
    if (taggedUserId === actorUserId) continue;
    void notifications.notify(taggedUserId, 'mention', {
      actorName: actor?.displayName,
      actorHandle: actor?.handle,
      actorAvatarUrl: actor?.avatarUrl,
      text: 'tagged you in a post.',
      href: `/p/${postId}`,
    });
  }
}

/** Reels: public reels (+ followed/private visible), newest first. */
export async function reels(userId: string, cursor?: string) {
  const v = await viewer(userId);
  const c = decodeCursor(cursor);
  const rows = await getDb()
    .select({ p: posts })
    .from(posts)
    .innerJoin(socialAccounts, eq(socialAccounts.id, posts.authorAccountId))
    .where(
      and(
        eq(posts.kind, 'reel'),
        isNull(posts.deletedAt),
        or(
          eq(socialAccounts.visibility, 'public'),
          inArray(posts.authorAccountId, [v.accountId, ...v.following, ...v.groupAccountIds]),
        ),
        c ? or(lt(posts.publishedAt, c.at), and(eq(posts.publishedAt, c.at), lt(posts.id, c.id))) : undefined,
        v.blockedAccountIds.size ? notInArray(posts.authorAccountId, [...v.blockedAccountIds]) : undefined,
      ),
    )
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(PAGE + 1);
  const page = rows.slice(0, PAGE).map((r) => r.p);
  return {
    items: await postDTOs(page, userId),
    nextCursor:
      rows.length > PAGE ? encodeCursor(page[page.length - 1].publishedAt, page[page.length - 1].id) : null,
  };
}

/** Insert a published post (personal composer, or a group draft that passed policy). */
export async function insertPost(
  input: {
    authorAccountId: string;
    createdByUserId: string | null;
    kind: PostKind;
    caption: string;
    altText?: string | null;
    locationLabel?: string | null;
    mediaIds: string[];
    altTexts?: (string | null)[];
    visibility: Visibility;
    sourceKind?: PostSourceKind;
    sourceId?: string | null;
    draftId?: string | null;
    topicTags?: string[];
  },
  tx = getDb(),
): Promise<PostRow> {
  const id = uuidv7();
  const [row] = await tx
    .insert(posts)
    .values({
      id,
      authorAccountId: input.authorAccountId,
      createdByUserId: input.createdByUserId,
      kind: input.kind,
      caption: input.caption,
      altText: input.altText ?? null,
      locationLabel: input.locationLabel ?? null,
      visibility: input.visibility,
      sourceKind: input.sourceKind ?? 'manual',
      sourceId: input.sourceId ?? null,
      draftId: input.draftId ?? null,
      topicTags: input.topicTags ?? [],
    })
    .returning();
  await tx.insert(postMedia).values(
    input.mediaIds.map((m, i) => ({
      postId: id,
      mediaId: m,
      sortOrder: i,
      altText: input.altTexts?.[i] ?? (i === 0 ? (input.altText ?? null) : null),
    })),
  );
  return row;
}

function validateKind(kind: PostKind, mediaRows: { kind: string }[]) {
  if (kind === 'reel' && (mediaRows.length !== 1 || mediaRows[0].kind !== 'video'))
    throw badRequest('A reel is exactly one video');
  if (kind === 'photo' && mediaRows.length !== 1) throw badRequest('A photo post has one image');
  if (kind === 'carousel' && (mediaRows.length < 2 || mediaRows.length > 10))
    throw badRequest('A carousel has 2–10 items');
}

/**
 * POST /posts: personal publish OR group draft (server decides by policy, section 8.1 step 3).
 * Group authors are routed to groups.service and return a draft unless policy allows direct publish.
 */
export async function topicTagsFor(caption: string): Promise<string[]> {
  if (!caption.trim()) return [];
  try {
    const discovery = await import('../discovery/service');
    return await discovery.tagCaption(caption);
  } catch (err) {
    logger.warn({ err }, 'caption tags skipped');
    return [];
  }
}

export async function createPost(userId: string, body: CreatePostBody) {
  const author = await accountById(body.authorAccountId);
  if (!author) throw notFound('Account not found');
  const mediaRows = await media.assertUsable(body.mediaIds, userId);
  const ordered = body.mediaIds.map((id) => mediaRows.find((m) => m.id === id)!);
  validateKind(body.kind, ordered);
  if (author.type === 'group') {
    const groups = await import('../groups/service');
    return groups.postFromComposer(userId, author, body);
  }
  if (author.ownerUserId !== userId) throw forbidden();
  const row = await insertPost({
    authorAccountId: author.id,
    createdByUserId: userId,
    kind: body.kind,
    caption: body.caption,
    altText: body.altText,
    locationLabel: body.locationLabel,
    mediaIds: body.mediaIds,
    visibility: author.visibility,
    topicTags: await topicTagsFor(body.caption),
  });
  await tagPeople(row.id, userId, body.taggedHandles);
  return { type: 'post' as const, post: (await postDTOs([row], userId))[0] };
}

export async function deletePost(userId: string, postId: string) {
  const [row] = await getDb().select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!row) throw notFound();
  const a = await accountById(row.authorAccountId);
  if (a?.ownerUserId !== userId && row.createdByUserId !== userId) throw forbidden();
  await getDb().update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, postId));
}

// ── engagement ────────────────────────────────────────────────────────────────────
async function signal(userId: string, tags: string[], kind: 'like' | 'save' | 'share' | 'follow') {
  try {
    const d = await import('../discovery/service');
    await d.recordSignal(userId, tags, kind);
  } catch (err) {
    if ((err as Error).name !== 'NotImplemented') logger.warn({ err }, 'recordSignal failed');
  }
}

export async function recordEngagement(
  userId: string,
  targetType: string,
  targetId: string,
  kind: EngagementKind,
  tags: string[] = [],
) {
  await getDb()
    .insert(engagementEvents)
    .values({ actorUserId: userId, targetType, targetId, kind, topicTags: tags })
    .catch(() => {});
}

async function visiblePost(userId: string, postId: string) {
  const [row] = await getDb()
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  if (!row) throw notFound('Post not found');
  const a = await accountById(row.authorAccountId);
  if (!a || !canSeeAccount(a, await viewer(userId))) throw forbidden();
  return { row, author: a };
}

export async function like(userId: string, postId: string, on: boolean) {
  const { row, author } = await visiblePost(userId, postId);
  const db = getDb();
  if (on) {
    const ins = await db.insert(postLikes).values({ postId, userId }).onConflictDoNothing().returning();
    if (ins.length) {
      await db
        .update(posts)
        .set({ likeCount: sql`${posts.likeCount} + 1` })
        .where(eq(posts.id, postId));
      void recordEngagement(userId, 'post', postId, 'like', row.topicTags);
      void signal(userId, row.topicTags, 'like');
      if (author.type === 'personal' && author.ownerUserId && author.ownerUserId !== userId) {
        const me = await users.accountSummary((await users.requirePersonalAccount(userId)).id);
        void notifications.notify(
          author.ownerUserId,
          'like',
          {
            actorName: me?.displayName,
            actorHandle: me?.handle,
            actorAvatarUrl: me?.avatarUrl,
            text: 'liked your post.',
            href: `/p/${postId}`,
          },
          { dedupeKey: `like:${postId}:${userId}`, push: false },
        );
      }
    }
  } else {
    const del = await db
      .delete(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
      .returning();
    if (del.length) {
      await db
        .update(posts)
        .set({ likeCount: sql`greatest(${posts.likeCount} - 1, 0)` })
        .where(eq(posts.id, postId));
      void recordEngagement(userId, 'post', postId, 'unlike', row.topicTags);
    }
  }
  const [u] = await db.select({ likeCount: posts.likeCount }).from(posts).where(eq(posts.id, postId));
  return { liked: on, likeCount: u.likeCount };
}

export async function save(userId: string, postId: string, on: boolean) {
  const { row } = await visiblePost(userId, postId);
  if (on) {
    const ins = await getDb().insert(postSaves).values({ postId, userId }).onConflictDoNothing().returning();
    if (ins.length) {
      void recordEngagement(userId, 'post', postId, 'save', row.topicTags);
      void signal(userId, row.topicTags, 'save');
    }
  } else
    await getDb()
      .delete(postSaves)
      .where(and(eq(postSaves.postId, postId), eq(postSaves.userId, userId)));
  return { saved: on };
}

export async function share(userId: string, postId: string) {
  const { row } = await visiblePost(userId, postId);
  void recordEngagement(userId, 'post', postId, 'share', row.topicTags);
  void signal(userId, row.topicTags, 'share');
}

export async function listComments(userId: string, postId: string): Promise<CommentDTO[]> {
  await visiblePost(userId, postId);
  const rows = await getDb()
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt)
    .limit(300);
  const authors = await users.accountSummaries(rows.map((r) => r.authorAccountId));
  return rows.map((r) => ({
    id: r.id,
    postId,
    author: authors.get(r.authorAccountId)!,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function addComment(userId: string, postId: string, body: string): Promise<CommentDTO> {
  const { author } = await visiblePost(userId, postId);
  const acct = await users.requirePersonalAccount(userId);
  const [row] = await getDb()
    .insert(comments)
    .values({ id: uuidv7(), postId, authorAccountId: acct.id, body })
    .returning();
  await getDb()
    .update(posts)
    .set({ commentCount: sql`${posts.commentCount} + 1` })
    .where(eq(posts.id, postId));
  const me = await users.accountSummary(acct.id);
  if (author.type === 'personal' && author.ownerUserId && author.ownerUserId !== userId) {
    void notifications.notify(
      author.ownerUserId,
      'comment',
      {
        actorName: me?.displayName,
        actorHandle: me?.handle,
        actorAvatarUrl: me?.avatarUrl,
        text: `commented: ${body.slice(0, 80)}`,
        href: `/p/${postId}`,
      },
      { push: false },
    );
  }
  for (const h of new Set([...body.matchAll(/@([a-z0-9._]{2,30})/gi)].map((m) => m[1].toLowerCase()))) {
    const target = await accountByHandle(h);
    if (target?.ownerUserId && target.ownerUserId !== userId)
      void notifications.notify(target.ownerUserId, 'mention', {
        actorName: me?.displayName,
        actorHandle: me?.handle,
        actorAvatarUrl: me?.avatarUrl,
        text: 'mentioned you in a comment.',
        href: `/p/${postId}`,
      });
  }
  return { id: row.id, postId, author: me!, body: row.body, createdAt: row.createdAt.toISOString() };
}

// ── stories ─────────────────────────────────────────────────────────────────────
async function storyDTOs(rows: (typeof stories.$inferSelect)[], viewerUserId: string): Promise<StoryDTO[]> {
  if (!rows.length) return [];
  const [m, seen] = await Promise.all([
    media.mediaDTOs(rows.map((r) => r.mediaId)),
    getDb()
      .select({ s: storyViews.storyId })
      .from(storyViews)
      .where(
        and(
          inArray(
            storyViews.storyId,
            rows.map((r) => r.id),
          ),
          eq(storyViews.viewerUserId, viewerUserId),
        ),
      ),
  ]);
  const byId = new Map(m.map((x) => [x.id, x]));
  const seenSet = new Set(seen.map((s) => s.s));
  return rows
    .filter((r) => byId.has(r.mediaId))
    .map((r) => ({
      id: r.id,
      media: byId.get(r.mediaId)!,
      caption: r.caption,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      seen: seenSet.has(r.id),
    }));
}

/** Active stories grouped by author account (own first, unseen before seen). */
export async function storyRail(userId: string): Promise<StoryRailItemDTO[]> {
  const v = await viewer(userId);
  const authorIds = [...new Set([v.accountId, ...v.following, ...v.groupAccountIds])].filter(
    (id) => !v.blockedAccountIds.has(id),
  );
  const rows = authorIds.length
    ? await getDb()
        .select()
        .from(stories)
        .where(and(inArray(stories.authorAccountId, authorIds), gt(stories.expiresAt, new Date())))
        .orderBy(stories.createdAt)
    : [];
  const dtos = await storyDTOs(rows, userId);
  const byAuthor = new Map<string, StoryDTO[]>();
  rows.forEach((r) => {
    const d = dtos.find((x) => x.id === r.id);
    if (d) byAuthor.set(r.authorAccountId, [...(byAuthor.get(r.authorAccountId) ?? []), d]);
  });
  const authors = await users.accountSummaries([...byAuthor.keys()]);
  const items = [...byAuthor.entries()].map(([id, list]) => ({
    author: authors.get(id)!,
    stories: list,
    allSeen: list.every((s) => s.seen),
    isGroup: authors.get(id)?.type === 'group',
  }));
  return items.sort((a, b) =>
    a.author.id === v.accountId
      ? -1
      : b.author.id === v.accountId
        ? 1
        : Number(a.allSeen) - Number(b.allSeen),
  );
}

export async function accountStories(userId: string, accountId: string) {
  const a = await accountById(accountId);
  if (!a) throw notFound();
  if (!canSeeAccount(a, await viewer(userId))) throw forbidden();
  const rows = await getDb()
    .select()
    .from(stories)
    .where(and(eq(stories.authorAccountId, accountId), gt(stories.expiresAt, new Date())))
    .orderBy(stories.createdAt);
  return { author: (await users.accountSummary(accountId))!, stories: await storyDTOs(rows, userId) };
}

export async function createStory(
  userId: string,
  body: { authorAccountId: string; mediaId: string; caption?: string },
) {
  const author = await accountById(body.authorAccountId);
  if (!author) throw notFound();
  await media.assertUsable([body.mediaId], userId);
  if (author.type === 'group') {
    const groups = await import('../groups/service');
    return groups.storyFromComposer(userId, author, body);
  }
  if (author.ownerUserId !== userId) throw forbidden();
  return { type: 'story' as const, story: await insertStory(author.id, userId, body.mediaId, body.caption) };
}

export async function insertStory(
  authorAccountId: string,
  userId: string | null,
  mediaId: string,
  caption?: string | null,
) {
  const [row] = await getDb()
    .insert(stories)
    .values({
      id: uuidv7(),
      authorAccountId,
      createdByUserId: userId,
      mediaId,
      caption: caption ?? null,
      expiresAt: new Date(Date.now() + env.STORY_TTL_MINUTES * 60_000),
    })
    .returning();
  return row;
}

export async function viewStory(userId: string, storyId: string) {
  await getDb().insert(storyViews).values({ storyId, viewerUserId: userId }).onConflictDoNothing();
  void recordEngagement(userId, 'story', storyId, 'view_3s');
}

// ── explore ─────────────────────────────────────────────────────────────────────────────────
/**
 * Explore (section 8.1 step 7): search accounts + group accounts (handle/name) and posts by caption via
 * `search_tsv` (GIN, sql/005). Without a query: public posts ranked by recent engagement. Private accounts'
 * posts never appear for non-followers.
 */
export async function explore(userId: string, q: string | undefined, cursor?: string) {
  const v = await viewer(userId);
  const db = getDb();
  const offset = Number(cursor ?? 0) || 0;
  const visible = sql`(${socialAccounts.visibility} = 'public' or ${posts.authorAccountId} in (${sql.join(
    [v.accountId, ...v.following, ...v.groupAccountIds].map((id) => sql`${id}::uuid`),
    sql`, `,
  )}))`;
  const hidden = v.blockedAccountIds.size
    ? notInArray(socialAccounts.id, [...v.blockedAccountIds])
    : undefined;
  if (q?.trim()) {
    const term = `%${q.trim().replace(/[%_]/g, '')}%`;
    const acctRows = await db
      .select({ id: socialAccounts.id })
      .from(socialAccounts)
      .where(
        and(
          sql`(${socialAccounts.handle}::text ilike ${term} or ${socialAccounts.displayName} ilike ${term})`,
          sql`${socialAccounts.onboardedAt} is not null`,
          hidden,
        ),
      )
      .orderBy(
        sql`case when ${socialAccounts.handle}::text ilike ${`${q.trim()}%`} then 0 else 1 end`,
        socialAccounts.handle,
      )
      .limit(20);
    const postRows = await db
      .select({ p: posts })
      .from(posts)
      .innerJoin(socialAccounts, eq(socialAccounts.id, posts.authorAccountId))
      .where(
        and(
          isNull(posts.deletedAt),
          visible,
          sql`${posts.searchTsv} @@ websearch_to_tsquery('simple', ${q.trim()})`,
          hidden,
        ),
      )
      .orderBy(desc(posts.publishedAt))
      .limit(30)
      .offset(offset);
    const summaries = await users.accountSummaries(acctRows.map((r) => r.id));
    return {
      accounts: acctRows.map((r) => summaries.get(r.id)!).filter(Boolean),
      posts: await postDTOs(
        postRows.map((r) => r.p),
        userId,
      ),
      nextCursor: postRows.length === 30 ? String(offset + 30) : null,
    };
  }
  const rows = await db
    .select({ p: posts })
    .from(posts)
    .innerJoin(socialAccounts, eq(socialAccounts.id, posts.authorAccountId))
    .where(and(isNull(posts.deletedAt), visible, hidden, sql`${posts.authorAccountId} <> ${v.accountId}`))
    .orderBy(
      sql`(${posts.likeCount} * 2 + ${posts.commentCount} * 3) / power(extract(epoch from (now() - ${posts.publishedAt})) / 3600 + 2, 1.3) desc`,
      desc(posts.publishedAt),
    )
    .limit(30)
    .offset(offset);
  return {
    accounts: [],
    posts: await postDTOs(
      rows.map((r) => r.p),
      userId,
    ),
    nextCursor: rows.length === 30 ? String(offset + 30) : null,
  };
}
