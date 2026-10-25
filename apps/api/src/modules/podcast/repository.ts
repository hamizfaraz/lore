import {
  and,
  conversationMembers,
  eq,
  inArray,
  isNull,
  mediaAssets,
  podcastShows,
  podcastStations,
  user,
  voiceContributions,
} from '@lore/db';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../../lib/db';

export class PodcastRepository {
  async membership(conversationId: string, userId: string) {
    const [row] = await getDb()
      .select({ role: conversationMembers.role })
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

  async currentMembers(conversationId: string) {
    return getDb()
      .select({ userId: conversationMembers.userId, displayName: user.name })
      .from(conversationMembers)
      .innerJoin(user, eq(user.id, conversationMembers.userId))
      .where(
        and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.removedAt)),
      );
  }

  async create(conversationId: string, hostUserId: string, title: string) {
    const members = await this.currentMembers(conversationId);
    const showId = uuidv7();
    const stationId = uuidv7();
    await getDb().transaction(async (tx) => {
      await tx.insert(podcastShows).values({
        id: showId,
        conversationId,
        title,
        requiredParticipantIds: members.map((member) => member.userId),
        hostUserId,
      });
      await tx.insert(podcastStations).values({
        id: stationId,
        showId,
        topic: title,
        participantIds: members.map((member) => member.userId),
      });
    });
    return showId;
  }

  async show(showId: string) {
    const [show] = await getDb().select().from(podcastShows).where(eq(podcastShows.id, showId)).limit(1);
    return show ?? null;
  }

  async stations(showId: string) {
    return getDb()
      .select()
      .from(podcastStations)
      .where(eq(podcastStations.showId, showId))
      .orderBy(podcastStations.createdAt);
  }

  async contributions(stationIds: string[]) {
    if (!stationIds.length) return [];
    return getDb()
      .select({
        id: voiceContributions.id,
        stationId: voiceContributions.stationId,
        userId: voiceContributions.userId,
        displayName: user.name,
        mediaId: voiceContributions.mediaId,
        replyToId: voiceContributions.replyToId,
        durationMs: voiceContributions.durationMs,
        day: voiceContributions.day,
        transcript: voiceContributions.transcript,
        createdAt: voiceContributions.createdAt,
      })
      .from(voiceContributions)
      .innerJoin(user, eq(user.id, voiceContributions.userId))
      .where(inArray(voiceContributions.stationId, stationIds))
      .orderBy(voiceContributions.createdAt);
  }

  async media(mediaId: string) {
    const [row] = await getDb()
      .select({
        id: mediaAssets.id,
        ownerUserId: mediaAssets.ownerUserId,
        kind: mediaAssets.kind,
        durationMs: mediaAssets.durationMs,
        transcript: mediaAssets.transcript,
        completedAt: mediaAssets.completedAt,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, mediaId))
      .limit(1);
    return row ?? null;
  }

  async addContribution(input: {
    stationId: string;
    userId: string;
    mediaId: string;
    replyToId?: string;
    durationMs: number;
    transcript: string | null;
    day: string;
  }) {
    const [row] = await getDb()
      .insert(voiceContributions)
      .values({ id: uuidv7(), ...input })
      .returning();
    return row!;
  }

  async branch(showId: string, parentStationId: string, topic: string, participantIds: string[]) {
    const [row] = await getDb()
      .insert(podcastStations)
      .values({ id: uuidv7(), showId, parentStationId, topic, participantIds })
      .returning();
    return row!;
  }

  async wrap(showId: string, at: Date) {
    await getDb().transaction(async (tx) => {
      await tx
        .update(podcastShows)
        .set({ wrappedAt: at, state: 'eligible_to_finish' })
        .where(eq(podcastShows.id, showId));
      await tx.update(podcastStations).set({ state: 'wrapped' }).where(eq(podcastStations.showId, showId));
    });
  }

  async finish(showId: string, renderMediaId: string | null) {
    await getDb()
      .update(podcastShows)
      .set({ state: 'finished', renderMediaId })
      .where(eq(podcastShows.id, showId));
  }
}

export const podcastRepository = new PodcastRepository();
