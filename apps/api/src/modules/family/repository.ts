import {
  and,
  conversationMembers,
  eq,
  familyStories,
  familyStoryContributions,
  gte,
  inArray,
  isNull,
  lte,
  mediaAssets,
  messages,
  user,
} from '@lore/db';
import type { FamilyStorySpec } from '@lore/shared/ai';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../../lib/db';

export type FamilyMembership = { role: string; aiHistoryConsent: boolean };
export type FamilyStoryRow = typeof familyStories.$inferSelect;

export class FamilyRepository {
  async membership(conversationId: string, userId: string): Promise<FamilyMembership | null> {
    const [row] = await getDb()
      .select({ role: conversationMembers.role, aiHistoryConsent: conversationMembers.aiHistoryConsent })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
          isNull(conversationMembers.removedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(conversationId: string, from: Date, to: Date) {
    const eligible = await getDb()
      .select({
        sourceMessageId: messages.id,
        contributorUserId: messages.senderUserId,
      })
      .from(messages)
      .innerJoin(
        conversationMembers,
        and(
          eq(conversationMembers.conversationId, messages.conversationId),
          eq(conversationMembers.userId, messages.senderUserId),
          eq(conversationMembers.aiHistoryConsent, true),
          isNull(conversationMembers.removedAt),
        ),
      )
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderType, 'human'),
          isNull(messages.deletedAt),
          gte(messages.createdAt, from),
          lte(messages.createdAt, to),
        ),
      );
    const id = uuidv7();
    const [story] = await getDb()
      .insert(familyStories)
      .values({ id, conversationId, title: 'Untitled family story', periodLabel: periodLabel(from, to) })
      .returning();
    const contributions = eligible.flatMap((row) =>
      row.contributorUserId
        ? [{ storyId: id, sourceMessageId: row.sourceMessageId, contributorUserId: row.contributorUserId }]
        : [],
    );
    if (contributions.length) await getDb().insert(familyStoryContributions).values(contributions);
    return story!;
  }

  async story(id: string): Promise<FamilyStoryRow | null> {
    const [row] = await getDb().select().from(familyStories).where(eq(familyStories.id, id)).limit(1);
    return row ?? null;
  }

  async sources(storyId: string) {
    const rows = await getDb()
      .select({
        sourceMessageId: familyStoryContributions.sourceMessageId,
        contributorUserId: familyStoryContributions.contributorUserId,
        contributorName: user.name,
        contributorAvatarUrl: user.image,
        include: familyStoryContributions.include,
        correction: familyStoryContributions.correction,
        createdAt: messages.createdAt,
        body: messages.body,
        mediaIds: messages.mediaIds,
      })
      .from(familyStoryContributions)
      .innerJoin(messages, eq(messages.id, familyStoryContributions.sourceMessageId))
      .innerJoin(user, eq(user.id, familyStoryContributions.contributorUserId))
      .where(eq(familyStoryContributions.storyId, storyId));
    const mediaIds = [...new Set(rows.flatMap((row) => row.mediaIds))];
    const media = mediaIds.length
      ? await getDb()
          .select({
            id: mediaAssets.id,
            kind: mediaAssets.kind,
            transcript: mediaAssets.transcript,
            caption: mediaAssets.captionAi,
          })
          .from(mediaAssets)
          .where(inArray(mediaAssets.id, mediaIds))
      : [];
    return rows.map((row) => ({
      ...row,
      text: row.correction ?? row.body ?? '',
      media: media.filter((item) => row.mediaIds.includes(item.id)),
    }));
  }

  async updateSource(
    storyId: string,
    sourceMessageId: string,
    values: { include?: boolean; correction?: string | null },
  ) {
    const [row] = await getDb()
      .update(familyStoryContributions)
      .set(values)
      .where(
        and(
          eq(familyStoryContributions.storyId, storyId),
          eq(familyStoryContributions.sourceMessageId, sourceMessageId),
        ),
      )
      .returning();
    return row ?? null;
  }

  async saveSpec(id: string, spec: FamilyStorySpec) {
    const [row] = await getDb()
      .update(familyStories)
      .set({
        title: spec.title,
        periodLabel: spec.periodLabel,
        chapters: spec.chapters,
        flags: spec.flags,
        state: spec.flags.length ? 'contributor_review' : 'private_draft',
      })
      .where(eq(familyStories.id, id))
      .returning();
    return row!;
  }

  async resolveFlag(id: string, sourceMessageId: string) {
    const story = await this.story(id);
    if (!story) return null;
    const flags = (story.flags ?? []).filter((flag) => flag.sourceMessageId !== sourceMessageId);
    const [row] = await getDb()
      .update(familyStories)
      .set({ flags, state: flags.length ? 'contributor_review' : 'private_draft' })
      .where(eq(familyStories.id, id))
      .returning();
    return row ?? null;
  }

  async setState(id: string, state: FamilyStoryRow['state']) {
    const [row] = await getDb()
      .update(familyStories)
      .set({ state })
      .where(eq(familyStories.id, id))
      .returning();
    return row ?? null;
  }
}

function periodLabel(from: Date, to: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const first = formatter.format(from);
  const last = formatter.format(to);
  return first === last ? first : `${first} – ${last}`;
}

export const familyRepository = new FamilyRepository();
