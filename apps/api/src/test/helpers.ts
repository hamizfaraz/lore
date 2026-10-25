import { conversationMembers, conversations, socialAccounts, user } from '@lore/db';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../lib/db';

export const hasDb = Boolean(process.env.DATABASE_URL);

/** Insert a user + personal account directly (bypasses Better Auth for speed). */
export async function makeUser(name = 'Test') {
  const id = uuidv7();
  const tag = id.slice(-8);
  await getDb()
    .insert(user)
    .values({ id, name, email: `t-${tag}@test.lore` });
  await getDb()
    .insert(socialAccounts)
    .values({
      id: uuidv7(),
      type: 'personal',
      handle: `t_${tag}`,
      displayName: name,
      ownerUserId: id,
      onboardedAt: new Date(),
    });
  return id;
}

export async function makeGroup(memberIds: string[], title = 'Test group') {
  const id = uuidv7();
  await getDb().insert(conversations).values({ id, kind: 'group', title, createdByUserId: memberIds[0] });
  await getDb()
    .insert(conversationMembers)
    .values(
      memberIds.map((u, i) => ({
        conversationId: id,
        userId: u,
        role: i === 0 ? ('primary_admin' as const) : ('member' as const),
      })),
    );
  return id;
}
