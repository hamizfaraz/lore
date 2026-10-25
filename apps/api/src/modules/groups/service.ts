import { createHash } from 'node:crypto';
import { and, eq, inArray, sql } from '@lore/db';
import { approvals, auditLog, conversations, postDrafts, publishingPolicies, socialAccounts } from '@lore/db';
import type { CreateGroupAccountBody, DraftCardDTO, PolicyDTO, PolicyInput } from '@lore/shared/dto/groups';
import type { CreatePostBody, PostDTO } from '@lore/shared/dto/social';
import type { ApprovalDecision, MemberRole, PostKind, PostSourceKind } from '@lore/shared/enums';
import { rooms } from '@lore/shared/events';
import { uuidv7 } from '@lore/shared/ids';
import {
  type Approval,
  type DraftForPolicy,
  type PolicySnapshot,
  approvalsNeeded,
  mayPublish,
} from '@lore/shared/policy';
import { type Actor, actorUserId } from '../../lib/actor';
import { type Db, getDb } from '../../lib/db';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { emit } from '../../lib/socket';
import * as chat from '../chat/service';
import * as media from '../media/service';
import * as notifications from '../notifications/service';
import * as social from '../social/service';
import * as users from '../users/service';

/** groups business logic [C1]: group accounts, publishing policies, drafts, approvals, publish (section 8.4). */

type DraftRow = typeof postDrafts.$inferSelect;
type AccountRow = typeof socialAccounts.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const ALL_ROLES: MemberRole[] = ['primary_admin', 'admin', 'publisher', 'member'];

async function audit(
  actor: Actor,
  action: string,
  targetType: string,
  targetId: string | null,
  meta: Record<string, unknown> = {},
  tx: Db | Tx = getDb(),
) {
  await tx.insert(auditLog).values({
    id: uuidv7(),
    actorType: actor.type === 'ai' ? 'ai' : actor.type,
    actorId: actorUserId(actor) ?? (actor.type === 'ai' ? actor.personaId : null),
    action,
    targetType,
    targetId,
    meta,
  });
}

// ── group accounts & policies ────────────────────────────────────────────────────────────
export async function createGroupAccount(convId: string, userId: string, body: CreateGroupAccountBody) {
  const me = await chat.requireMember(convId, userId);
  if (!chat.isAdmin(me)) throw forbidden('Only admins can create the group account');
  const db = getDb();
  const [c] = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
  if (!c || c.kind !== 'group') throw badRequest('Group accounts belong to group chats');
  if (c.groupAccountId) throw conflict('This group already has an account');
  const handle = body.handle.toLowerCase();
  if (await users.isHandleTaken(handle)) throw conflict('That username is taken');
  if (body.avatarMediaId) await media.assertUsable([body.avatarMediaId], userId);
  const members = await chat.activeMembers(convId);
  const primary = members.find((m) => m.role === 'primary_admin')?.userId ?? userId;
  const id = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(socialAccounts).values({
      id,
      type: 'group',
      handle,
      displayName: body.displayName,
      bio: body.bio ?? null,
      avatarMediaId: body.avatarMediaId ?? null,
      visibility: body.visibility,
      conversationId: convId,
      primaryAdminUserId: primary,
      onboardedAt: new Date(),
    });
    await tx.insert(publishingPolicies).values(policyValues(id, body.policy, userId));
    await tx.update(conversations).set({ groupAccountId: id }).where(eq(conversations.id, convId));
    await audit(
      { type: 'user', userId },
      'group_account.create',
      'account',
      id,
      { handle, policy: body.policy },
      tx,
    );
  });
  const name = (await users.userCards([userId])).get(userId)!.displayName.split(' ')[0];
  await chat.postMessage(
    convId,
    { kind: 'system', body: `${name} created the group account @${handle}` },
    { type: 'system' },
  );
  return users.accountSummary(id);
}

function policyValues(accountId: string, p: PolicyInput, userId: string) {
  if (p.mode === 'threshold' && !p.threshold)
    throw badRequest('Threshold policy needs a number of approvals');
  return {
    accountId,
    mode: p.mode,
    threshold: p.mode === 'threshold' ? (p.threshold ?? 1) : null,
    eligibleRoles: p.eligibleRoles?.length ? p.eligibleRoles : ALL_ROLES,
    storyMode: p.storyMode ?? null,
    updatedBy: userId,
    updatedAt: new Date(),
  };
}

async function groupAccount(accountId: string): Promise<AccountRow> {
  const [a] = await getDb().select().from(socialAccounts).where(eq(socialAccounts.id, accountId)).limit(1);
  if (!a || a.type !== 'group' || !a.conversationId) throw notFound('Group account not found');
  return a;
}

async function policyRow(accountId: string) {
  const [p] = await getDb()
    .select()
    .from(publishingPolicies)
    .where(eq(publishingPolicies.accountId, accountId))
    .limit(1);
  return (
    p ?? {
      accountId,
      mode: 'threshold' as const,
      threshold: 1,
      eligibleRoles: ALL_ROLES as string[],
      storyMode: null,
      updatedBy: null,
      updatedAt: new Date(0),
    }
  );
}

export async function getPolicy(accountId: string, userId: string): Promise<PolicyDTO> {
  const a = await groupAccount(accountId);
  await chat.requireMember(a.conversationId!, userId);
  const p = await policyRow(accountId);
  return {
    accountId,
    mode: p.mode,
    threshold: p.threshold,
    eligibleRoles: p.eligibleRoles,
    storyMode: p.storyMode,
    updatedAt: p.updatedAt?.toISOString() ?? null,
  };
}

/** Policy editing is admin-only and logged (section 8.4 step 2). */
export async function putPolicy(accountId: string, userId: string, input: PolicyInput): Promise<PolicyDTO> {
  const a = await groupAccount(accountId);
  const me = await chat.requireMember(a.conversationId!, userId);
  if (!chat.isAdmin(me)) throw forbidden('Only admins can change the publishing policy');
  const v = policyValues(accountId, input, userId);
  await getDb()
    .insert(publishingPolicies)
    .values(v)
    .onConflictDoUpdate({ target: publishingPolicies.accountId, set: v });
  await audit({ type: 'user', userId }, 'policy.update', 'account', accountId, { ...input });
  const label = input.mode === 'threshold' ? `${v.threshold} approvals` : input.mode;
  const name = (await users.userCards([userId])).get(userId)!.displayName.split(' ')[0];
  await chat.postMessage(
    a.conversationId!,
    { kind: 'system', body: `${name} set @${a.handle}'s publishing policy to ${label}` },
    { type: 'system' },
  );
  return getPolicy(accountId, userId);
}

// ── eligibility ───────────────────────────────────────────────────────────────────────────
async function eligibleVoters(convId: string, eligibleRoles: string[]) {
  const ms = await chat.activeMembers(convId);
  return ms
    .filter(
      (m) =>
        eligibleRoles.includes(m.role) &&
        !(m.muteUntil && m.muteUntil > new Date() && m.muteScope === 'publishing'),
    )
    .map((m) => m.userId);
}

/** Snapshot ∩ current active eligible members: removed (or publishing-muted) members' approvals stop counting. */
async function effectiveDraft(d: DraftRow): Promise<DraftForPolicy> {
  const snap = d.policySnapshot ?? { mode: 'threshold', threshold: 1, eligibleVoterIds: [] };
  const p = await policyRow(d.accountId);
  const current = new Set(await eligibleVoters(d.conversationId, p.eligibleRoles));
  return {
    version: d.version,
    createdByAi: d.createdByAi,
    policySnapshot: { ...snap, eligibleVoterIds: snap.eligibleVoterIds.filter((id) => current.has(id)) },
  };
}

async function canDirect(userId: string | null, a: AccountRow) {
  if (!userId) return false;
  const p = await policyRow(a.id);
  const m = await chat.membership(a.conversationId!, userId);
  if (!m || !p.eligibleRoles.includes(m.role)) return false;
  if (m.muteUntil && m.muteUntil > new Date() && m.muteScope === 'publishing') return false;
  return p.mode === 'direct' || p.mode === 'courtesy';
}

const hashContent = (caption: string, mediaIds: string[]) =>
  createHash('sha256').update(JSON.stringify({ caption, mediaIds })).digest('hex');

// ── DTO ─────────────────────────────────────────────────────────────────────────────────────
export async function draftCardDTO(draftId: string): Promise<DraftCardDTO> {
  const db = getDb();
  const [d] = await db.select().from(postDrafts).where(eq(postDrafts.id, draftId)).limit(1);
  if (!d) throw notFound('Draft not found');
  const eff = await effectiveDraft(d);
  const [account, mediaList, apprs] = await Promise.all([
    users.accountSummary(d.accountId),
    media.mediaDTOs(d.mediaIds),
    db
      .select()
      .from(approvals)
      .where(and(eq(approvals.draftId, d.id), eq(approvals.version, d.version))),
  ]);
  const voterIds = eff.policySnapshot.eligibleVoterIds.length
    ? eff.policySnapshot.eligibleVoterIds
    : await eligibleVoters(d.conversationId, (await policyRow(d.accountId)).eligibleRoles);
  const cards = await users.userCards([
    ...voterIds,
    ...apprs.map((a) => a.userId),
    ...(d.createdByUserId ? [d.createdByUserId] : []),
  ]);
  return {
    id: d.id,
    account: account!,
    conversationId: d.conversationId,
    kind: d.kind,
    caption: d.caption,
    media: mediaList,
    version: d.version,
    state: d.state,
    createdByAi: d.createdByAi,
    createdBy: d.createdByUserId
      ? { userId: d.createdByUserId, displayName: cards.get(d.createdByUserId)!.displayName }
      : null,
    policy: d.policySnapshot
      ? {
          mode: d.policySnapshot.mode,
          threshold: d.policySnapshot.threshold ?? null,
          eligibleVoterIds: eff.policySnapshot.eligibleVoterIds,
        }
      : null,
    needed: d.policySnapshot ? approvalsNeeded(eff) : 0,
    approvals: apprs
      .filter((a) => voterIds.includes(a.userId))
      .map((a) => ({
        userId: a.userId,
        displayName: cards.get(a.userId)!.displayName,
        avatarUrl: cards.get(a.userId)!.avatarUrl,
        decision: a.decision,
        note: a.note,
      })),
    voters: voterIds.map((id) => ({
      userId: id,
      displayName: cards.get(id)!.displayName,
      avatarUrl: cards.get(id)!.avatarUrl,
    })),
    publishedPostId: d.publishedPostId,
    sourceKind: d.sourceKind,
    updatedAt: d.updatedAt.toISOString(),
  };
}

async function broadcast(draftId: string) {
  const dto = await draftCardDTO(draftId);
  emit(rooms.conv(dto.conversationId), 'draft.updated', dto);
  await chat.refreshCard(dto.conversationId, 'draft_card', draftId).catch(() => {});
  return dto;
}

// ── drafts ────────────────────────────────────────────────────────────────────────────────
export type CreateDraftInput = {
  accountId: string;
  conversationId: string;
  kind: PostKind;
  caption: string;
  mediaIds: string[];
  audioLabel?: string | null;
  source?: { kind: PostSourceKind; id?: string | null };
  /** AI drafts (recaps, game results, family stories) are always submitted, never published directly */
  createdByAi?: boolean;
  submit?: boolean;
  target?: 'post' | 'story';
};

/** Cross-boundary [C1 implements, C2 calls]: create a draft, post its draft_card to the chat. */
export async function createDraft(input: CreateDraftInput, actor: Actor): Promise<DraftCardDTO> {
  const a = await groupAccount(input.accountId);
  if (a.conversationId !== input.conversationId)
    throw badRequest('Account does not belong to this conversation');
  const uid = actorUserId(actor);
  const byAi = Boolean(input.createdByAi) || actor.type === 'ai';
  if (uid) {
    const m = await chat.requireMember(input.conversationId, uid);
    if (m.muteUntil && m.muteUntil > new Date() && m.muteScope === 'publishing')
      throw forbidden('An admin muted your publishing for now');
    await media.assertUsable(input.mediaIds, uid, { allowAi: byAi });
  }
  if (!input.mediaIds.length) throw badRequest('A draft needs media');
  const id = uuidv7();
  await getDb()
    .insert(postDrafts)
    .values({
      id,
      accountId: a.id,
      conversationId: input.conversationId,
      createdByUserId: uid,
      createdByAi: byAi,
      kind: input.kind,
      target: input.target ?? 'post',
      caption: input.caption ?? '',
      mediaIds: input.mediaIds,
      audioLabel: input.audioLabel ?? null,
      version: 1,
      contentHash: hashContent(input.caption ?? '', input.mediaIds),
      state: 'editing',
      sourceKind: input.source?.kind ?? 'manual',
      sourceId: input.source?.id ?? null,
    });
  await audit(actor, 'draft.create', 'draft', id, { accountId: a.id, byAi });
  const msg = await chat.postMessage(
    input.conversationId,
    { kind: 'card', cardKind: 'draft_card', cardRefId: id, meta: byAi ? { aiDraft: true } : {} },
    byAi && actor.type === 'ai' ? actor : uid ? { type: 'user', userId: uid } : { type: 'system' },
  );
  await getDb().update(postDrafts).set({ messageId: msg.id }).where(eq(postDrafts.id, id));
  if (byAi || input.submit) return submit(id, actor, { autoApproveAuthor: !byAi });
  return draftCardDTO(id);
}

/** Submitting freezes policy_snapshot = { mode, threshold, eligibleVoterIds } (section 8.4 step 3). */
export async function submit(
  draftId: string,
  actor: Actor,
  opts: { autoApproveAuthor?: boolean } = {},
): Promise<DraftCardDTO> {
  const db = getDb();
  const [d] = await db.select().from(postDrafts).where(eq(postDrafts.id, draftId)).limit(1);
  if (!d) throw notFound();
  if (d.state === 'published' || d.state === 'cancelled') throw conflict('Draft is closed');
  const uid = actorUserId(actor);
  if (uid) await chat.requireMember(d.conversationId, uid);
  const p = await policyRow(d.accountId);
  const mode = d.target === 'story' ? (p.storyMode ?? p.mode) : p.mode;
  const snapshot: PolicySnapshot = {
    mode,
    threshold: mode === 'threshold' ? (p.threshold ?? 1) : null,
    eligibleVoterIds: await eligibleVoters(d.conversationId, p.eligibleRoles),
  };
  await db
    .update(postDrafts)
    .set({ state: 'submitted', policySnapshot: snapshot, updatedAt: new Date() })
    .where(eq(postDrafts.id, draftId));
  // The human author's submission counts as their approval of this version.
  if (opts.autoApproveAuthor !== false && uid && !d.createdByAi && snapshot.eligibleVoterIds.includes(uid)) {
    await db
      .insert(approvals)
      .values({ draftId, version: d.version, userId: uid, decision: 'approve' })
      .onConflictDoNothing();
  }
  await audit(actor, 'draft.submit', 'draft', draftId, { snapshot });
  const a = await groupAccount(d.accountId);
  const author = uid ? (await users.userCards([uid])).get(uid) : null;
  for (const v of snapshot.eligibleVoterIds) {
    if (v === uid) continue;
    void notifications.notify(
      v,
      'draft_needs_approval',
      {
        actorName: author?.displayName ?? 'Milo',
        actorHandle: author?.handle ?? undefined,
        actorAvatarUrl: author?.avatarUrl ?? null,
        text: `submitted a post for @${a.handle} — Review`,
        href: `/c/${d.conversationId}`,
        accountId: a.id,
      },
      { dedupeKey: `draft:${draftId}:${d.version}` },
    );
  }
  return tryPublish(draftId, actor);
}

/** Edits bump version, recompute content hash, and void earlier approvals (kept under the old version). */
export async function patchDraft(
  draftId: string,
  userId: string,
  patch: { caption?: string; mediaIds?: string[]; audioLabel?: string | null },
) {
  const db = getDb();
  const [d] = await db.select().from(postDrafts).where(eq(postDrafts.id, draftId)).limit(1);
  if (!d) throw notFound();
  await chat.requireMember(d.conversationId, userId);
  if (d.state === 'published' || d.state === 'cancelled') throw conflict('This draft is closed');
  const a = await groupAccount(d.accountId);
  const p = await policyRow(a.id);
  const m = await chat.membership(d.conversationId, userId);
  if (d.createdByUserId !== userId && !(m && (chat.isAdmin(m) || p.eligibleRoles.includes(m.role))))
    throw forbidden();
  if (patch.mediaIds) await media.assertUsable(patch.mediaIds, userId, { allowAi: true });
  const caption = patch.caption ?? d.caption;
  const mediaIds = patch.mediaIds ?? d.mediaIds;
  const hash = hashContent(caption, mediaIds);
  if (hash === d.contentHash && patch.audioLabel === undefined) return draftCardDTO(draftId);
  await db
    .update(postDrafts)
    .set({
      caption,
      mediaIds,
      audioLabel: patch.audioLabel === undefined ? d.audioLabel : patch.audioLabel,
      contentHash: hash,
      version: d.version + 1,
      state: d.state === 'editing' ? 'editing' : 'submitted',
      updatedAt: new Date(),
    })
    .where(eq(postDrafts.id, draftId));
  await audit({ type: 'user', userId }, 'draft.edit', 'draft', draftId, { fromVersion: d.version });
  return broadcast(draftId);
}

/** Approve / request changes for the current version; threshold & unanimous auto-publish on the last approval. */
export async function decide(draftId: string, userId: string, decision: ApprovalDecision, note?: string) {
  const db = getDb();
  const [d] = await db.select().from(postDrafts).where(eq(postDrafts.id, draftId)).limit(1);
  if (!d) throw notFound();
  await chat.requireMember(d.conversationId, userId);
  if (d.state !== 'submitted' && d.state !== 'changes_requested')
    throw conflict(d.state === 'published' ? 'Already published' : 'Draft is not awaiting approval');
  const eff = await effectiveDraft(d);
  if (!eff.policySnapshot.eligibleVoterIds.includes(userId))
    throw forbidden("You can't approve for this account");
  await db
    .insert(approvals)
    .values({ draftId, version: d.version, userId, decision, note: note ?? null })
    .onConflictDoUpdate({
      target: [approvals.draftId, approvals.version, approvals.userId],
      set: { decision, note: note ?? null, decidedAt: new Date() },
    });
  await audit({ type: 'user', userId }, `draft.${decision}`, 'draft', draftId, { version: d.version });
  if (decision === 'request_changes') {
    await db
      .update(postDrafts)
      .set({ state: 'changes_requested', updatedAt: new Date() })
      .where(eq(postDrafts.id, draftId));
    return broadcast(draftId);
  }
  if (d.state === 'changes_requested')
    await db.update(postDrafts).set({ state: 'submitted' }).where(eq(postDrafts.id, draftId));
  return tryPublish(draftId, { type: 'user', userId });
}

/** Explicit publish (direct / courtesy). Same locked path as auto-publish. */
export async function publish(draftId: string, userId: string) {
  const [d] = await getDb().select().from(postDrafts).where(eq(postDrafts.id, draftId)).limit(1);
  if (!d) throw notFound();
  await chat.requireMember(d.conversationId, userId);
  const dto = await tryPublish(draftId, { type: 'user', userId }, { explicit: true });
  if (dto.state !== 'published') throw forbidden('This draft still needs approvals');
  return dto;
}

export async function cancel(draftId: string, userId: string) {
  const [d] = await getDb().select().from(postDrafts).where(eq(postDrafts.id, draftId)).limit(1);
  if (!d) throw notFound();
  const m = await chat.requireMember(d.conversationId, userId);
  if (d.createdByUserId !== userId && !chat.isAdmin(m)) throw forbidden();
  if (d.state === 'published') throw conflict('Already published');
  await getDb()
    .update(postDrafts)
    .set({ state: 'cancelled', updatedAt: new Date() })
    .where(eq(postDrafts.id, draftId));
  await audit({ type: 'user', userId }, 'draft.cancel', 'draft', draftId);
  return broadcast(draftId);
}

/**
 * Runs mayPublish() inside a transaction with SELECT … FOR UPDATE on the draft, so two simultaneous
 * approvals cannot double-publish (section 8.4 step 4). Returns the (possibly published) card.
 */
async function tryPublish(
  draftId: string,
  actor: Actor,
  opts: { explicit?: boolean } = {},
): Promise<DraftCardDTO> {
  const db = getDb();
  const uid = actorUserId(actor);
  const result = await db.transaction(async (tx) => {
    const locked = await tx.execute<{ id: string }>(
      sql`select id from post_drafts where id = ${draftId} for update`,
    );
    if (!(locked as unknown as unknown[]).length) throw notFound();
    const [d] = await tx.select().from(postDrafts).where(eq(postDrafts.id, draftId));
    if (d.state !== 'submitted') return null;
    const a = await groupAccount(d.accountId);
    const eff = await effectiveDraft(d);
    const apprs: Approval[] = (await tx.select().from(approvals).where(eq(approvals.draftId, draftId))).map(
      (x) => ({ userId: x.userId, version: x.version, decision: x.decision }),
    );
    // direct/courtesy human drafts publish only on an explicit action by an eligible member (or composer direct publish)
    const direct = eff.policySnapshot.mode === 'direct' || eff.policySnapshot.mode === 'courtesy';
    if (direct && !d.createdByAi && !opts.explicit) return null;
    const ok = mayPublish(eff, apprs, { userId: uid ?? '', canDirect: await canDirect(uid, a) });
    if (!ok) return null;
    let postId: string | null = null;
    if (d.target === 'story') {
      const st = await social.insertStory(a.id, d.createdByUserId, d.mediaIds[0], d.caption || null);
      postId = st.id;
    } else {
      const row = await social.insertPost(
        {
          authorAccountId: a.id,
          createdByUserId: d.createdByUserId,
          kind: d.kind,
          caption: d.caption,
          mediaIds: d.mediaIds,
          visibility: a.visibility,
          sourceKind: d.sourceKind,
          sourceId: d.sourceId,
          draftId: d.id,
        },
        tx as unknown as Db,
      );
      postId = row.id;
    }
    await tx
      .update(postDrafts)
      .set({
        state: 'published',
        publishedPostId: d.target === 'story' ? null : postId,
        updatedAt: new Date(),
      })
      .where(eq(postDrafts.id, draftId));
    await audit(
      actor,
      'draft.publish',
      'draft',
      draftId,
      {
        postId,
        target: d.target,
        approvers: [
          ...new Set(
            apprs.filter((x) => x.version === d.version && x.decision === 'approve').map((x) => x.userId),
          ),
        ],
      },
      tx,
    );
    return { postId, target: d.target, account: a, conversationId: d.conversationId };
  });
  if (result) {
    const members = await chat.activeMembers(result.conversationId);
    for (const m of members) {
      if (result.target === 'post' && result.postId)
        emit(rooms.user(m.userId), 'post.published', { postId: result.postId, accountId: result.account.id });
      void notifications.notify(
        m.userId,
        'post_published',
        {
          actorHandle: result.account.handle,
          text:
            result.target === 'story' ? 'added to the group story.' : 'published a new post from your group.',
          href: result.target === 'post' ? `/p/${result.postId}` : `/g/${result.account.handle}`,
          accountId: result.account.id,
        },
        { push: m.userId !== uid },
      );
    }
  }
  return broadcast(draftId);
}

// ── composer entry points (POST /posts and POST /stories with a group author) ──────────────
export async function postFromComposer(
  userId: string,
  author: { id: string },
  body: CreatePostBody,
): Promise<{ type: 'post'; post: PostDTO } | { type: 'draft'; draftId: string }> {
  const a = await groupAccount(author.id);
  const direct = await canDirect(userId, a);
  const p = await policyRow(a.id);
  const draft = await createDraft(
    {
      accountId: a.id,
      conversationId: a.conversationId!,
      kind: body.kind,
      caption: body.caption,
      mediaIds: body.mediaIds,
      submit: true,
    },
    { type: 'user', userId },
  );
  if (direct && !(p.mode === 'courtesy' && body.requestReview)) {
    const published = await publish(draft.id, userId);
    const post = await social.getPost(published.publishedPostId!, userId);
    return { type: 'post', post };
  }
  return { type: 'draft', draftId: draft.id };
}

export async function storyFromComposer(
  userId: string,
  author: { id: string },
  body: { mediaId: string; caption?: string },
) {
  const a = await groupAccount(author.id);
  const p = await policyRow(a.id);
  const mode = p.storyMode ?? p.mode;
  const draft = await createDraft(
    {
      accountId: a.id,
      conversationId: a.conversationId!,
      kind: 'photo',
      caption: body.caption ?? '',
      mediaIds: [body.mediaId],
      submit: true,
      target: 'story',
    },
    { type: 'user', userId },
  );
  if ((mode === 'direct' || mode === 'courtesy') && (await canDirect(userId, a))) {
    await publish(draft.id, userId);
    return { type: 'story' as const, story: null };
  }
  return { type: 'draft' as const, draftId: draft.id };
}

export async function listDrafts(accountId: string, userId: string) {
  const a = await groupAccount(accountId);
  await chat.requireMember(a.conversationId!, userId);
  const rows = await getDb()
    .select({ id: postDrafts.id })
    .from(postDrafts)
    .where(
      and(
        eq(postDrafts.accountId, accountId),
        inArray(postDrafts.state, ['editing', 'submitted', 'changes_requested']),
      ),
    );
  return Promise.all(rows.map((r) => draftCardDTO(r.id)));
}

export async function getDraft(draftId: string, userId: string) {
  const dto = await draftCardDTO(draftId);
  await chat.requireMember(dto.conversationId, userId);
  return dto;
}

export function logFailure(err: unknown) {
  logger.warn({ err }, 'groups failure');
}
