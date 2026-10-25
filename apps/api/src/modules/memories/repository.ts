import {
  and,
  conversationMembers,
  desc,
  eq,
  inArray,
  isNull,
  mediaAssets,
  messages,
  recapMediaConsents,
  recaps,
} from '@lore/db';
import type { PatchRecapBody } from '@lore/shared/dto/memories';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../../lib/db';
import type { MemoryMedia, MemoryMessage, RecapConsent, StoredRecap } from './types';

export class MemoriesRepository {
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

  async sourceMessages(conversationId: string): Promise<MemoryMessage[]> {
    return getDb()
      .select({ id: messages.id, body: messages.body, createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
      .orderBy(desc(messages.createdAt))
      .limit(30);
  }

  async media(conversationId: string, requestedIds?: string[]): Promise<MemoryMedia[]> {
    const messageRows = await getDb()
      .select({ id: messages.id, mediaIds: messages.mediaIds })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
      .orderBy(desc(messages.createdAt))
      .limit(250);
    const sourceByMedia = new Map<string, string[]>();
    for (const message of messageRows) {
      for (const mediaId of message.mediaIds) {
        sourceByMedia.set(mediaId, [...(sourceByMedia.get(mediaId) ?? []), message.id]);
      }
    }
    const ids = requestedIds?.length
      ? requestedIds.filter((id) => sourceByMedia.has(id))
      : [...sourceByMedia.keys()];
    if (!ids.length) return [];
    const rows = await getDb().select().from(mediaAssets).where(inArray(mediaAssets.id, ids));
    return rows.map((row) => {
      const scope = (row.consentScope ?? null) as Record<string, unknown> | null;
      return {
        id: row.id,
        ownerUserId: row.ownerUserId,
        kind: row.kind,
        mime: row.mime,
        width: row.width,
        height: row.height,
        durationMs: row.durationMs,
        blurhash: row.blurhash,
        aiGenerated: row.aiGenerated,
        generator: row.generator,
        transcript: row.transcript,
        transcriptStatus: row.transcriptStatus,
        captionAi: row.captionAi,
        consentScope: scope,
        createdAt: row.createdAt,
        sourceMessageIds: sourceByMedia.get(row.id) ?? [],
        quality: typeof scope?.quality === 'number' ? scope.quality : 0.75,
        perceptualHash: typeof scope?.perceptualHash === 'string' ? scope.perceptualHash : null,
      };
    });
  }

  async list(conversationId: string): Promise<StoredRecap[]> {
    return (await getDb()
      .select()
      .from(recaps)
      .where(eq(recaps.conversationId, conversationId))
      .orderBy(desc(recaps.createdAt))) as StoredRecap[];
  }

  async recap(recapId: string): Promise<StoredRecap | null> {
    const [row] = await getDb().select().from(recaps).where(eq(recaps.id, recapId)).limit(1);
    return (row as StoredRecap | undefined) ?? null;
  }

  async consents(recapId: string): Promise<RecapConsent[]> {
    return (await getDb()
      .select()
      .from(recapMediaConsents)
      .where(eq(recapMediaConsents.recapId, recapId))) as RecapConsent[];
  }

  async create(input: Omit<StoredRecap, 'id' | 'createdAt'>, media: MemoryMedia[]): Promise<StoredRecap> {
    const id = uuidv7();
    const [row] = await getDb()
      .insert(recaps)
      .values({ id, ...input })
      .returning();
    const owned = media.filter((item): item is MemoryMedia & { ownerUserId: string } =>
      Boolean(item.ownerUserId),
    );
    if (owned.length) {
      await getDb()
        .insert(recapMediaConsents)
        .values(
          owned.map((item) => ({
            recapId: id,
            mediaId: item.id,
            ownerUserId: item.ownerUserId,
            include: true,
          })),
        )
        .onConflictDoNothing();
    }
    return row as StoredRecap;
  }

  async patch(
    recapId: string,
    input: PatchRecapBody & {
      coverMediaId?: string | null;
      collageMediaId?: string | null;
      state?: StoredRecap['state'];
    },
  ) {
    const [row] = await getDb()
      .update(recaps)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.layout !== undefined ? { layout: input.layout } : {}),
        ...(input.mediaIds !== undefined ? { mediaIds: input.mediaIds } : {}),
        ...(input.coverMediaId !== undefined ? { coverMediaId: input.coverMediaId } : {}),
        ...(input.collageMediaId !== undefined ? { collageMediaId: input.collageMediaId } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
      })
      .where(eq(recaps.id, recapId))
      .returning();
    return (row as StoredRecap | undefined) ?? null;
  }

  async setConsent(recapId: string, mediaId: string, ownerUserId: string, include: boolean) {
    await getDb()
      .insert(recapMediaConsents)
      .values({ recapId, mediaId, ownerUserId, include })
      .onConflictDoUpdate({
        target: [recapMediaConsents.recapId, recapMediaConsents.mediaId],
        set: { ownerUserId, include },
      });
  }

  async mediaOwner(mediaId: string): Promise<string | null> {
    const [row] = await getDb()
      .select({ ownerUserId: mediaAssets.ownerUserId })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, mediaId))
      .limit(1);
    return row?.ownerUserId ?? null;
  }
}

export const memoriesRepository = new MemoriesRepository();
