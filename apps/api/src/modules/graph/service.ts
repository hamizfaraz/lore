import {
  account as authAccounts,
  and,
  eq,
  facebookImports,
  follows,
  inArray,
  ne,
  socialAccounts,
  sql,
} from '@lore/db';
import type { ConnectionsDTO, GraphImportResultDTO, LoreFriendDTO } from '@lore/shared/dto/graph';
import { getDb } from '../../lib/db';
import { badRequest } from '../../lib/errors';
import { logger } from '../../lib/logger';
import * as users from '../users/service';
import { tagsFromLikes } from './categories';
import { type GraphProfile, fetchGraphProfile, parseScope } from './facebook';

/** graph business logic [C1] — Facebook import, friends on LORE, disconnect (section 8.6). */

type LikeRow = { id: string; name: string; category: string };

async function facebookAuth(userId: string) {
  const [row] = await getDb()
    .select()
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, 'facebook')))
    .limit(1);
  return row ?? null;
}

async function importRow(userId: string) {
  const [row] = await getDb()
    .select()
    .from(facebookImports)
    .where(eq(facebookImports.userId, userId))
    .limit(1);
  return row ?? null;
}

/** User ids of LORE accounts whose Facebook id is in `friendFbIds`, plus anyone who listed us. */
async function matchingUserIds(userId: string, fbUserId: string, friendFbIds: string[]): Promise<string[]> {
  const db = getDb();
  const ids = new Set<string>();
  if (friendFbIds.length) {
    const byImport = await db
      .select({ userId: facebookImports.userId })
      .from(facebookImports)
      .where(and(inArray(facebookImports.fbUserId, friendFbIds), ne(facebookImports.userId, userId)));
    for (const r of byImport) ids.add(r.userId);
    const byLogin = await db
      .select({ userId: authAccounts.userId })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.providerId, 'facebook'),
          inArray(authAccounts.accountId, friendFbIds),
          ne(authAccounts.userId, userId),
        ),
      );
    for (const r of byLogin) ids.add(r.userId);
  }
  if (fbUserId) {
    const reverse = await db
      .select({ userId: facebookImports.userId })
      .from(facebookImports)
      .where(and(sql`${fbUserId} = ANY(${facebookImports.friendFbIds})`, ne(facebookImports.userId, userId)));
    for (const r of reverse) ids.add(r.userId);
  }
  return [...ids];
}

async function friendsOnLore(
  userId: string,
  fbUserId: string,
  friendFbIds: string[],
): Promise<LoreFriendDTO[]> {
  const userIds = await matchingUserIds(userId, fbUserId, friendFbIds);
  if (!userIds.length) return [];
  const personals = await users.personalAccountsByUser(userIds);
  const accountIds = [...personals.values()].map((a) => a.id);
  if (!accountIds.length) return [];
  const summaries = await users.accountSummaries(accountIds);
  const meAcct = await users.requirePersonalAccount(userId);
  const rels = await getDb()
    .select({ id: follows.targetAccountId, status: follows.status })
    .from(follows)
    .where(and(eq(follows.followerAccountId, meAcct.id), inArray(follows.targetAccountId, accountIds)));
  const byTarget = new Map(rels.map((r) => [r.id, r.status]));
  return [...summaries.values()]
    .map((a) => ({
      ...a,
      following: byTarget.get(a.id) === 'active',
      pending: byTarget.get(a.id) === 'pending',
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function handTagsToDiscovery(userId: string, tags: string[]) {
  try {
    const d = await import('../discovery/service');
    await d.recordSignal(userId, tags, 'graph');
  } catch (err) {
    if ((err as Error).name !== 'NotImplemented') logger.warn({ err }, 'recordSignal(graph) failed');
  }
}

async function maybeSetFacebookAvatar(userId: string, pictureUrl: string | null) {
  if (!pictureUrl) return;
  const acct = await users.getPersonalAccount(userId);
  if (!acct || acct.avatarMediaId || acct.avatarUrl) return;
  await getDb().update(socialAccounts).set({ avatarUrl: pictureUrl }).where(eq(socialAccounts.id, acct.id));
}

function toTags(tags: string[]) {
  return tags.map((tag) => ({ tag, from: 'facebook' as const }));
}

/** Persist a Graph profile. `profile` is injectable so tests never call Facebook. */
export async function importGraph(userId: string, profile: GraphProfile): Promise<GraphImportResultDTO> {
  const db = getDb();
  const tags = tagsFromLikes(profile.likes);
  const importedAt = new Date();
  await db
    .insert(facebookImports)
    .values({
      userId,
      fbUserId: profile.id,
      grantedScopes: profile.grantedScopes,
      likes: profile.likes,
      friendFbIds: profile.friendIds,
      importedAt,
    })
    .onConflictDoUpdate({
      target: facebookImports.userId,
      set: {
        fbUserId: profile.id,
        grantedScopes: profile.grantedScopes,
        likes: profile.likes,
        friendFbIds: profile.friendIds,
        importedAt,
      },
    });
  await maybeSetFacebookAvatar(userId, profile.pictureUrl);
  await handTagsToDiscovery(userId, tags);
  const friends = await friendsOnLore(userId, profile.id, profile.friendIds);
  return {
    grantedScopes: profile.grantedScopes,
    suggestedTags: toTags(tags),
    friendsOnLore: friends,
    importedAt: importedAt.toISOString(),
  };
}

/** POST /graph/import — uses the Facebook access token Better Auth stored at login. */
export async function importForUser(userId: string): Promise<GraphImportResultDTO> {
  const auth = await facebookAuth(userId);
  if (!auth?.accessToken) throw badRequest('Connect Facebook before importing');
  const profile = await fetchGraphProfile(auth.accessToken, auth.scope);
  return importGraph(userId, profile);
}

export async function connections(userId: string): Promise<ConnectionsDTO> {
  const [row, auth] = await Promise.all([importRow(userId), facebookAuth(userId)]);
  const fbUserId = row?.fbUserId ?? auth?.accountId ?? null;
  if (!fbUserId && !auth) return { facebook: null, suggestedTags: [], friendsOnLore: [] };
  const likes = (row?.likes ?? []) as LikeRow[];
  const tags = tagsFromLikes(likes);
  const friends = row ? await friendsOnLore(userId, row.fbUserId, row.friendFbIds ?? []) : [];
  return {
    facebook: {
      fbUserId: fbUserId ?? auth!.accountId,
      grantedScopes: row?.grantedScopes?.length ? row.grantedScopes : parseScope(auth?.scope),
      importedAt: row?.importedAt ? row.importedAt.toISOString() : null,
    },
    suggestedTags: toTags(tags),
    friendsOnLore: friends,
  };
}

/**
 * The user kept a subset of the suggested tags (onboarding "you can edit them").
 * Hands only that subset to discovery as graph suggestions.
 */
export async function confirmSuggestions(userId: string, tags: string[]) {
  const row = await importRow(userId);
  if (!row) throw badRequest('Import Facebook before confirming interests');
  const allowed = new Set(tagsFromLikes((row.likes ?? []) as LikeRow[]));
  const kept = [...new Set(tags.filter((t) => allowed.has(t)))];
  await handTagsToDiscovery(userId, kept);
  return { tags: toTags(kept) };
}

/**
 * Disconnect Facebook: delete the import, the stored token, and Graph-sourced tags.
 * Email/password login is left alone.
 */
export async function disconnect(userId: string) {
  const row = await importRow(userId);
  const legacyTags = tagsFromLikes((row?.likes ?? []) as LikeRow[]);
  try {
    const discovery = await import('../discovery/service');
    await discovery.clearGraphSignals(userId, legacyTags);
  } catch (err) {
    if ((err as Error).name !== 'NotImplemented') logger.warn({ err }, 'clearGraphSignals failed');
  }
  const db = getDb();
  await db.delete(facebookImports).where(eq(facebookImports.userId, userId));
  await db
    .delete(authAccounts)
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, 'facebook')));
  return { ok: true as const };
}
