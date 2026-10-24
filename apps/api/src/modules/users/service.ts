import { and, eq, ilike, inArray, isNull, or, sql } from '@lore/db';
import {
  approvals,
  conversationMembers,
  facebookImports,
  postDrafts,
  publishingPolicies,
  socialAccounts,
  user,
} from '@lore/db';
import type { AccountSummaryDTO, ActingAccountDTO, MeDTO, UpdateProfileBody } from '@lore/shared/dto/users';
import type { MemberRole } from '@lore/shared/enums';
import { uuidv7 } from '@lore/shared/ids';
import type { SessionUser } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { badRequest, conflict, notFound } from '../../lib/errors';
import * as media from '../media/service';

/** users business logic [C1]: personal accounts, /me, profile, handles, account summaries. */

type AccountRow = typeof socialAccounts.$inferSelect;

const RESERVED = new Set([
  'admin',
  'lore',
  'milo',
  'api',
  'settings',
  'explore',
  'reels',
  'inbox',
  'login',
  'signup',
  'support',
]);

export function normalizeHandle(raw: string): string {
  const base = raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9._]+/g, '')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 24);
  return base.length >= 2 ? base : `user${base}`;
}

export async function isHandleTaken(handle: string, exceptAccountId?: string): Promise<boolean> {
  if (RESERVED.has(handle)) return true;
  const rows = await getDb()
    .select({ id: socialAccounts.id })
    .from(socialAccounts)
    .where(eq(socialAccounts.handle, handle))
    .limit(1);
  return rows.length > 0 && rows[0].id !== exceptAccountId;
}

/** Deduped with a number: ava, ava2, ava3 … (section 8.1). */
export async function uniqueHandle(seed: string): Promise<string> {
  const base = normalizeHandle(seed);
  if (!(await isHandleTaken(base))) return base;
  for (let n = 2; n < 500; n++) {
    const h = `${base.slice(0, 24)}${n}`;
    if (!(await isHandleTaken(h))) return h;
  }
  return `${base.slice(0, 18)}${Math.floor(Math.random() * 1e6)}`;
}

/** Called from the Better Auth user.create hook: every user gets a personal social account. */
export async function ensurePersonalAccount(u: {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}) {
  const db = getDb();
  const existing = await db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.ownerUserId, u.id), eq(socialAccounts.type, 'personal')))
    .limit(1);
  if (existing[0]) return existing[0];
  const seed = u.email && !u.email.endsWith('@guest.ourlore.tech') ? u.email.split('@')[0] : u.name;
  const handle = await uniqueHandle(seed || 'friend');
  const [row] = await db
    .insert(socialAccounts)
    .values({
      id: uuidv7(),
      type: 'personal',
      handle,
      displayName: u.name || handle,
      avatarUrl: u.image ?? null,
      ownerUserId: u.id,
      visibility: 'public',
    })
    .onConflictDoNothing()
    .returning();
  return row ?? (await getPersonalAccount(u.id));
}

export async function getPersonalAccount(userId: string): Promise<AccountRow | null> {
  const rows = await getDb()
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.ownerUserId, userId), eq(socialAccounts.type, 'personal')))
    .limit(1);
  return rows[0] ?? null;
}

export async function requirePersonalAccount(userId: string): Promise<AccountRow> {
  const a = await getPersonalAccount(userId);
  if (a) return a;
  const [u] = await getDb().select().from(user).where(eq(user.id, userId)).limit(1);
  if (!u) throw notFound('User not found');
  return (await ensurePersonalAccount(u))!;
}

export async function avatarUrlFor(
  a: Pick<AccountRow, 'avatarMediaId' | 'avatarUrl'>,
): Promise<string | null> {
  if (a.avatarMediaId) {
    const url = await media.signedUrl(a.avatarMediaId, { thumb: true }).catch(() => null);
    if (url) return url;
  }
  return a.avatarUrl ?? null;
}

/** Batched account summaries; group accounts include member avatars for the stacked badge. */
export async function accountSummaries(ids: string[]): Promise<Map<string, AccountSummaryDTO>> {
  const out = new Map<string, AccountSummaryDTO>();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return out;
  const db = getDb();
  const rows = await db.select().from(socialAccounts).where(inArray(socialAccounts.id, uniq));
  const groupConvIds = rows
    .filter((r) => r.type === 'group' && r.conversationId)
    .map((r) => r.conversationId!);
  const memberAvatarsByConv = new Map<string, (string | null)[]>();
  if (groupConvIds.length) {
    const members = await db
      .select({ conversationId: conversationMembers.conversationId, userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(inArray(conversationMembers.conversationId, groupConvIds), isNull(conversationMembers.removedAt)),
      );
    const personal = await personalAccountsByUser(members.map((m) => m.userId));
    for (const m of members) {
      const p = personal.get(m.userId);
      const list = memberAvatarsByConv.get(m.conversationId) ?? [];
      list.push(p ? await avatarUrlFor(p) : null);
      memberAvatarsByConv.set(m.conversationId, list);
    }
  }
  for (const r of rows) {
    out.set(r.id, {
      id: r.id,
      type: r.type,
      handle: r.handle,
      displayName: r.displayName,
      avatarUrl: await avatarUrlFor(r),
      visibility: r.visibility,
      memberAvatars:
        r.type === 'group' && r.conversationId
          ? (memberAvatarsByConv.get(r.conversationId) ?? [])
          : undefined,
      conversationId: r.conversationId,
    });
  }
  return out;
}

export async function accountSummary(id: string): Promise<AccountSummaryDTO | null> {
  return (await accountSummaries([id])).get(id) ?? null;
}

export async function personalAccountsByUser(userIds: string[]): Promise<Map<string, AccountRow>> {
  const uniq = [...new Set(userIds)];
  const m = new Map<string, AccountRow>();
  if (!uniq.length) return m;
  const rows = await getDb()
    .select()
    .from(socialAccounts)
    .where(and(inArray(socialAccounts.ownerUserId, uniq), eq(socialAccounts.type, 'personal')));
  for (const r of rows) m.set(r.ownerUserId!, r);
  return m;
}

/** Display info for users (chat senders, voters, members). */
export async function userCards(
  userIds: string[],
): Promise<
  Map<
    string,
    {
      userId: string;
      displayName: string;
      handle: string | null;
      avatarUrl: string | null;
      accountId: string | null;
    }
  >
> {
  const acc = await personalAccountsByUser(userIds);
  const missing = userIds.filter((id) => !acc.has(id));
  const names = new Map<string, { name: string; image: string | null }>();
  if (missing.length) {
    for (const u of await getDb()
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .where(inArray(user.id, missing)))
      names.set(u.id, { name: u.name, image: u.image });
  }
  const out = new Map();
  for (const id of new Set(userIds)) {
    const a = acc.get(id);
    out.set(
      id,
      a
        ? {
            userId: id,
            displayName: a.displayName,
            handle: a.handle,
            avatarUrl: await avatarUrlFor(a),
            accountId: a.id,
          }
        : {
            userId: id,
            displayName: names.get(id)?.name ?? 'Someone',
            handle: null,
            avatarUrl: names.get(id)?.image ?? null,
            accountId: null,
          },
    );
  }
  return out;
}

/** Group accounts the user can act as: roles in eligible_roles of the group's policy (section 8.4). */
export async function actingGroupAccounts(userId: string): Promise<ActingAccountDTO[]> {
  const db = getDb();
  const rows = await db
    .select({ account: socialAccounts, role: conversationMembers.role, policy: publishingPolicies })
    .from(socialAccounts)
    .innerJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, socialAccounts.conversationId),
        eq(conversationMembers.userId, userId),
        isNull(conversationMembers.removedAt),
      ),
    )
    .leftJoin(publishingPolicies, eq(publishingPolicies.accountId, socialAccounts.id))
    .where(eq(socialAccounts.type, 'group'));
  const summaries = await accountSummaries(rows.map((r) => r.account.id));
  return rows
    .filter((r) => !r.policy || r.policy.eligibleRoles.includes(r.role))
    .map((r) => ({
      ...summaries.get(r.account.id)!,
      role: r.role as MemberRole,
      canPublishDirect: !r.policy || r.policy.mode === 'direct' || r.policy.mode === 'courtesy',
    }));
}

export async function pendingApprovalCount(userId: string): Promise<number> {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(postDrafts)
    .where(
      and(
        eq(postDrafts.state, 'submitted'),
        sql`${postDrafts.policySnapshot} -> 'eligibleVoterIds' ? ${userId}`,
        sql`not exists (select 1 from ${approvals} a where a.draft_id = ${postDrafts.id} and a.version = ${postDrafts.version} and a.user_id = ${userId})`,
      ),
    );
  return rows[0]?.n ?? 0;
}

export async function getMe(u: SessionUser): Promise<MeDTO> {
  const acct = await requirePersonalAccount(u.id);
  const [personal, groups, pending, fb] = await Promise.all([
    accountSummary(acct.id),
    actingGroupAccounts(u.id),
    pendingApprovalCount(u.id),
    getDb()
      .select({ id: facebookImports.userId })
      .from(facebookImports)
      .where(eq(facebookImports.userId, u.id))
      .limit(1),
  ]);
  return {
    user: { id: u.id, email: u.email, name: u.name, image: u.image },
    personalAccount: personal,
    groupAccounts: groups,
    onboarded: Boolean(acct.onboardedAt),
    facebookLinked: fb.length > 0,
    pendingApprovals: pending,
  };
}

export async function updateProfile(userId: string, body: UpdateProfileBody) {
  const acct = await requirePersonalAccount(userId);
  const patch: Partial<AccountRow> = {};
  if (body.handle !== undefined) {
    const h = body.handle.toLowerCase();
    if (h !== acct.handle) {
      if (RESERVED.has(h)) throw badRequest('That username is not available');
      if (await isHandleTaken(h, acct.id)) throw conflict('That username is taken');
      patch.handle = h;
    }
  }
  if (body.displayName !== undefined) patch.displayName = body.displayName;
  if (body.bio !== undefined) patch.bio = body.bio;
  if (body.avatarMediaId !== undefined) patch.avatarMediaId = body.avatarMediaId;
  if (body.visibility !== undefined) patch.visibility = body.visibility;
  if (body.onboarded) patch.onboardedAt = acct.onboardedAt ?? new Date();
  if (Object.keys(patch).length)
    await getDb().update(socialAccounts).set(patch).where(eq(socialAccounts.id, acct.id));
  if (body.displayName)
    await getDb()
      .update(user)
      .set({ name: body.displayName, updatedAt: new Date() })
      .where(eq(user.id, userId));
  return accountSummary(acct.id);
}

/** People search (new message sheet, add members). Matches handle or display name. */
export async function searchPeople(q: string, viewerUserId: string, limit = 20) {
  const term = `%${q.trim().replace(/[%_]/g, '')}%`;
  const rows = await getDb()
    .select()
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.type, 'personal'),
        or(ilike(socialAccounts.handle, term), ilike(socialAccounts.displayName, term)),
        sql`${socialAccounts.ownerUserId} <> ${viewerUserId}`,
      ),
    )
    .limit(limit);
  return Promise.all(
    rows.map(async (r) => ({
      userId: r.ownerUserId!,
      accountId: r.id,
      handle: r.handle,
      displayName: r.displayName,
      avatarUrl: await avatarUrlFor(r),
    })),
  );
}
