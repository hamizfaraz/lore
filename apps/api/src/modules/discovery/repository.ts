import {
  and,
  eq,
  follows,
  inArray,
  interestProfiles,
  introductions,
  or,
  quizAnswers,
  socialAccounts,
} from '@lore/db';
import type { AccountSummaryDTO } from '@lore/shared/dto/users';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../../lib/db';
import type { DiscoveryCandidate, StoredInterestProfile, StoredIntroduction } from './types';

function summary(row: typeof socialAccounts.$inferSelect): AccountSummaryDTO {
  return {
    id: row.id,
    type: row.type,
    handle: row.handle,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    visibility: row.visibility,
    conversationId: row.conversationId,
  };
}

export class DiscoveryRepository {
  async profile(userId: string): Promise<StoredInterestProfile | null> {
    const [row] = await getDb()
      .select()
      .from(interestProfiles)
      .where(eq(interestProfiles.userId, userId))
      .limit(1);
    return (row as StoredInterestProfile | undefined) ?? null;
  }

  async saveProfile(input: Omit<StoredInterestProfile, 'updatedAt'>): Promise<StoredInterestProfile> {
    const [row] = await getDb()
      .insert(interestProfiles)
      .values({ ...input, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: interestProfiles.userId,
        set: {
          explicitTags: input.explicitTags,
          inferred: input.inferred,
          frozen: input.frozen,
          discoverable: input.discoverable,
          bioSnippet: input.bioSnippet,
          embedding: input.embedding,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row as StoredInterestProfile;
  }

  async saveQuiz(userId: string, answers: { questionId: string; answer: unknown }[]) {
    for (const answer of answers) {
      await getDb()
        .insert(quizAnswers)
        .values({ userId, ...answer })
        .onConflictDoUpdate({
          target: [quizAnswers.userId, quizAnswers.questionId],
          set: { answer: answer.answer },
        });
    }
  }

  async connectedUserIds(userId: string): Promise<Set<string>> {
    const [mine] = await getDb()
      .select({ id: socialAccounts.id })
      .from(socialAccounts)
      .where(and(eq(socialAccounts.ownerUserId, userId), eq(socialAccounts.type, 'personal')))
      .limit(1);
    if (!mine) return new Set();
    const links = await getDb()
      .select({ from: follows.followerAccountId, to: follows.targetAccountId })
      .from(follows)
      .where(
        and(
          eq(follows.status, 'active'),
          or(eq(follows.followerAccountId, mine.id), eq(follows.targetAccountId, mine.id)),
        ),
      );
    const accountIds = links.flatMap((link) => [link.from, link.to]).filter((id) => id !== mine.id);
    if (!accountIds.length) return new Set();
    const owners = await getDb()
      .select({ userId: socialAccounts.ownerUserId })
      .from(socialAccounts)
      .where(inArray(socialAccounts.id, accountIds));
    return new Set(owners.map((row) => row.userId).filter((id): id is string => Boolean(id)));
  }

  async candidates(excludeUserId: string): Promise<DiscoveryCandidate[]> {
    const rows = await getDb()
      .select({ profile: interestProfiles, account: socialAccounts })
      .from(interestProfiles)
      .innerJoin(
        socialAccounts,
        and(eq(socialAccounts.ownerUserId, interestProfiles.userId), eq(socialAccounts.type, 'personal')),
      )
      .where(eq(interestProfiles.discoverable, true));
    return rows
      .filter((row) => row.profile.userId !== excludeUserId)
      .map((row) => ({ ...(row.profile as StoredInterestProfile), account: summary(row.account) }));
  }

  async discoverableProfiles(): Promise<StoredInterestProfile[]> {
    return (await getDb()
      .select()
      .from(interestProfiles)
      .where(eq(interestProfiles.discoverable, true))) as StoredInterestProfile[];
  }

  async account(userId: string): Promise<AccountSummaryDTO | null> {
    const [row] = await getDb()
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.ownerUserId, userId), eq(socialAccounts.type, 'personal')))
      .limit(1);
    return row ? summary(row) : null;
  }

  async createIntroduction(input: Omit<StoredIntroduction, 'id' | 'createdAt' | 'state'>) {
    const [row] = await getDb()
      .insert(introductions)
      .values({ id: uuidv7(), ...input, state: 'requested' })
      .returning();
    return row as StoredIntroduction;
  }

  async introduction(id: string) {
    const [row] = await getDb().select().from(introductions).where(eq(introductions.id, id)).limit(1);
    return (row as StoredIntroduction | undefined) ?? null;
  }

  async introductions(userId: string) {
    return (await getDb()
      .select()
      .from(introductions)
      .where(
        or(eq(introductions.fromUserId, userId), eq(introductions.toUserId, userId)),
      )) as StoredIntroduction[];
  }

  async setIntroductionState(id: string, state: StoredIntroduction['state']) {
    const [row] = await getDb()
      .update(introductions)
      .set({ state })
      .where(eq(introductions.id, id))
      .returning();
    return row as StoredIntroduction;
  }

  async setStarter(id: string, firstMessage: string) {
    const [row] = await getDb()
      .update(introductions)
      .set({ firstMessage })
      .where(eq(introductions.id, id))
      .returning();
    return row as StoredIntroduction;
  }
}

export const discoveryRepository = new DiscoveryRepository();
