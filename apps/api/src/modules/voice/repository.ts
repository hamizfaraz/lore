import {
  agentActionAudit,
  aiPersonas,
  and,
  conversationMembers,
  eq,
  isNull,
  mediaAssets,
  messages,
  ne,
  socialAccounts,
  sql,
  user,
} from '@lore/db';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../../lib/db';
import type { VoiceAudit, VoiceMediaRecord, VoiceMessageRef } from './types';

export class VoiceRepository {
  async media(mediaId: string): Promise<VoiceMediaRecord | null> {
    const [row] = await getDb()
      .select({
        id: mediaAssets.id,
        ownerUserId: mediaAssets.ownerUserId,
        kind: mediaAssets.kind,
        mime: mediaAssets.mime,
        transcript: mediaAssets.transcript,
        transcriptStatus: mediaAssets.transcriptStatus,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, mediaId))
      .limit(1);
    return (row as VoiceMediaRecord | undefined) ?? null;
  }

  async messagesForMedia(mediaId: string): Promise<VoiceMessageRef[]> {
    return getDb()
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderUserId: messages.senderUserId,
      })
      .from(messages)
      .where(and(eq(messages.kind, 'voice'), sql`${mediaId}::uuid = any(${messages.mediaIds})`));
  }

  async setTranscript(
    mediaId: string,
    transcript: string | null,
    status: VoiceMediaRecord['transcriptStatus'],
  ): Promise<void> {
    await getDb()
      .update(mediaAssets)
      .set({ transcript, transcriptStatus: status })
      .where(
        status === 'failed'
          ? and(eq(mediaAssets.id, mediaId), ne(mediaAssets.transcriptStatus, 'done'))
          : eq(mediaAssets.id, mediaId),
      );
  }

  async isConversationMember(conversationId: string, userId: string): Promise<boolean> {
    const [row] = await getDb()
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
          isNull(conversationMembers.removedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async keywordsForConversation(conversationId: string): Promise<string[]> {
    const [members, accounts, personas] = await Promise.all([
      getDb()
        .select({ name: user.name })
        .from(conversationMembers)
        .innerJoin(user, eq(user.id, conversationMembers.userId))
        .where(
          and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.removedAt)),
        ),
      getDb()
        .select({ name: socialAccounts.displayName })
        .from(conversationMembers)
        .innerJoin(socialAccounts, eq(socialAccounts.ownerUserId, conversationMembers.userId))
        .where(
          and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.removedAt)),
        ),
      getDb()
        .select({ name: aiPersonas.name })
        .from(aiPersonas)
        .where(eq(aiPersonas.conversationId, conversationId)),
    ]);
    return [...new Set([...members, ...accounts, ...personas].map((row) => row.name.trim()).filter(Boolean))]
      .slice(0, 64)
      .map((name) => name.slice(0, 80));
  }

  async audit(entry: VoiceAudit): Promise<void> {
    await getDb()
      .insert(agentActionAudit)
      .values({
        id: uuidv7(),
        userId: entry.userId,
        tool: 'voice.transcribe',
        input: {
          mediaId: entry.mediaId,
          degraded: entry.degraded ?? false,
          source: entry.source,
          model: entry.model,
        },
        outcome: entry.outcome,
        detail: entry.detail?.slice(0, 500),
      });
  }
}

export const voiceRepository = new VoiceRepository();
