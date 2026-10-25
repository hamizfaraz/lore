import { and, eq, inArray, or, socialAccounts, userBlocks } from '@lore/db';
import { getDb } from '../../lib/db';
import { badRequest, forbidden } from '../../lib/errors';

export async function blockedUserIds(userId: string): Promise<Set<string>> {
  const rows = await getDb()
    .select()
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerUserId, userId), eq(userBlocks.blockedUserId, userId)));
  return new Set(rows.map((row) => (row.blockerUserId === userId ? row.blockedUserId : row.blockerUserId)));
}

export async function isBlocked(leftUserId: string, rightUserId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ blockerUserId: userBlocks.blockerUserId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerUserId, leftUserId), eq(userBlocks.blockedUserId, rightUserId)),
        and(eq(userBlocks.blockerUserId, rightUserId), eq(userBlocks.blockedUserId, leftUserId)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function assertNotBlocked(leftUserId: string, rightUserId: string) {
  if (leftUserId === rightUserId) return;
  if (await isBlocked(leftUserId, rightUserId)) throw forbidden('You cannot reach this person');
}

export async function blockedAccountIds(userId: string): Promise<Set<string>> {
  const users = [...(await blockedUserIds(userId))];
  if (!users.length) return new Set();
  const rows = await getDb()
    .select({ id: socialAccounts.id })
    .from(socialAccounts)
    .where(inArray(socialAccounts.ownerUserId, users));
  return new Set(rows.map((row) => row.id));
}

export async function blockUser(blockerUserId: string, blockedUserId: string) {
  if (blockerUserId === blockedUserId) throw badRequest('You cannot block yourself');
  await getDb().insert(userBlocks).values({ blockerUserId, blockedUserId }).onConflictDoNothing();
  return { blockedUserId };
}

export async function unblockUser(blockerUserId: string, blockedUserId: string) {
  await getDb()
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerUserId, blockerUserId), eq(userBlocks.blockedUserId, blockedUserId)));
  return { blockedUserId, blocked: false };
}

export async function listBlocks(blockerUserId: string) {
  const rows = await getDb()
    .select({ userId: userBlocks.blockedUserId, createdAt: userBlocks.createdAt })
    .from(userBlocks)
    .where(eq(userBlocks.blockerUserId, blockerUserId));
  return { blocks: rows.map((row) => ({ userId: row.userId, createdAt: row.createdAt.toISOString() })) };
}
