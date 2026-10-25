import {
  aiDecisions,
  aiMemories,
  aiPersonas,
  and,
  conversationMembers,
  conversations,
  desc,
  eq,
  eventCandidates,
  gt,
  gte,
  inArray,
  isNull,
  messages,
  ne,
  or,
  socialAccounts,
  sql,
} from '@lore/db';
import type {
  MemoryDTO,
  MemoryUpdateBody,
  PersonaDTO,
  PersonaExplanationDTO,
  PersonaUpdateBody,
} from '@lore/shared/dto/persona';
import type { MemberRole } from '@lore/shared/enums';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../../lib/db';
import { notFound } from '../../lib/errors';
import type {
  DecisionRecord,
  ExtractedMemory,
  MemoryRecord,
  PersonaContext,
  PersonaRecord,
  TranscriptMessage,
} from './types';

export type Membership = { role: MemberRole; aiHistoryConsent: boolean };

const PRESETS = {
  milo: {
    name: 'Milo',
    tone: ['warm', 'witty', 'brief'],
    interests: ['group plans', 'shared memories'],
    boundaries: 'Never embarrass a member or reveal private preferences.',
  },
  juniper: {
    name: 'Juniper',
    tone: ['gentle', 'curious', 'encouraging'],
    interests: ['creative ideas', 'check-ins'],
    boundaries: 'Keep the room calm and never pressure anyone to share.',
  },
  sol: {
    name: 'Sol',
    tone: ['upbeat', 'direct', 'playful'],
    interests: ['activities', 'celebrations'],
    boundaries: 'Avoid teasing about sensitive topics or personal constraints.',
  },
  custom: {
    name: 'Milo',
    tone: ['warm', 'helpful'],
    interests: [],
    boundaries: 'Never reveal private information or make sensitive inferences.',
  },
} as const;

function personaDto(row: PersonaRecord, avatarUrl: string | null = null): PersonaDTO {
  return {
    id: row.id,
    conversationId: row.conversationId,
    name: row.name,
    avatarUrl,
    tone: row.tone,
    interests: row.interests,
    boundaries: row.boundaries,
    initiative: row.initiative,
    quietHours: row.quietHours,
    allowHistory: row.allowHistory,
    allowNews: row.allowNews,
    allowImages: row.allowImages,
    allowPlans: row.allowPlans,
    allowLocation: row.allowLocation,
    surpriseImagesPerWeek: row.surpriseImagesPerWeek,
    enabled: row.enabled,
    mutedUntil: row.mutedUntil?.toISOString() ?? null,
  };
}

async function signedPersona(row: PersonaRecord): Promise<PersonaDTO> {
  if (!row.avatarMediaId) return personaDto(row);
  try {
    const media = await import('../media/service');
    return personaDto(row, await media.signedUrl(row.avatarMediaId));
  } catch {
    return personaDto(row);
  }
}

function memoryDto(row: MemoryRecord): MemoryDTO {
  return {
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    sensitivity: row.sensitivity,
    confidence: row.confidence,
    subjectUserIds: row.subjectUserIds,
    lastConfirmedAt: row.lastConfirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function personaSet(body: PersonaUpdateBody) {
  const preset = PRESETS[body.preset ?? 'milo'];
  return {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.avatarMediaId !== undefined ? { avatarMediaId: body.avatarMediaId } : {}),
    ...(body.tone !== undefined ? { tone: body.tone } : {}),
    ...(body.interests !== undefined ? { interests: body.interests } : {}),
    ...(body.boundaries !== undefined ? { boundaries: body.boundaries } : {}),
    ...(body.initiative !== undefined ? { initiative: body.initiative } : {}),
    ...(body.quietHours !== undefined ? { quietHours: body.quietHours } : {}),
    ...(body.allowHistory !== undefined ? { allowHistory: body.allowHistory } : {}),
    ...(body.allowNews !== undefined ? { allowNews: body.allowNews } : {}),
    ...(body.allowImages !== undefined ? { allowImages: body.allowImages } : {}),
    ...(body.allowPlans !== undefined ? { allowPlans: body.allowPlans } : {}),
    ...(body.allowLocation !== undefined ? { allowLocation: body.allowLocation } : {}),
    ...(body.surpriseImagesPerWeek !== undefined
      ? { surpriseImagesPerWeek: body.surpriseImagesPerWeek }
      : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.preset && body.name === undefined ? { name: preset.name } : {}),
    ...(body.preset && body.tone === undefined ? { tone: [...preset.tone] } : {}),
    ...(body.preset && body.interests === undefined ? { interests: [...preset.interests] } : {}),
    ...(body.preset && body.boundaries === undefined ? { boundaries: preset.boundaries } : {}),
  };
}

export class PersonaRepository {
  async membership(conversationId: string, userId: string): Promise<Membership | null> {
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

  async getPersonaRecord(conversationId: string): Promise<PersonaRecord | null> {
    const [row] = await getDb()
      .select()
      .from(aiPersonas)
      .where(eq(aiPersonas.conversationId, conversationId))
      .limit(1);
    return (row as PersonaRecord | undefined) ?? null;
  }

  async getPersona(conversationId: string): Promise<PersonaDTO | null> {
    const row = await this.getPersonaRecord(conversationId);
    return row ? signedPersona(row) : null;
  }

  async upsertPersona(
    conversationId: string,
    userId: string,
    body: PersonaUpdateBody,
  ): Promise<{ persona: PersonaDTO; created: boolean }> {
    const existing = await this.getPersonaRecord(conversationId);
    const preset = PRESETS[body.preset ?? 'milo'];
    const update = personaSet(body);
    const [row] = await getDb()
      .insert(aiPersonas)
      .values({
        id: existing?.id ?? uuidv7(),
        conversationId,
        createdByUserId: existing?.createdByUserId ?? userId,
        name: body.name ?? preset.name,
        tone: body.tone ?? [...preset.tone],
        interests: body.interests ?? [...preset.interests],
        boundaries: body.boundaries ?? preset.boundaries,
        initiative: body.initiative ?? 'balanced',
        quietHours: body.quietHours ?? null,
        allowHistory: body.allowHistory ?? true,
        allowNews: body.allowNews ?? true,
        allowImages: body.allowImages ?? true,
        allowPlans: body.allowPlans ?? true,
        allowLocation: body.allowLocation ?? false,
        surpriseImagesPerWeek: body.surpriseImagesPerWeek ?? 1,
        enabled: body.enabled ?? true,
        avatarMediaId: body.avatarMediaId ?? null,
      })
      .onConflictDoUpdate({
        target: aiPersonas.conversationId,
        set: Object.keys(update).length ? update : { enabled: existing?.enabled ?? true },
      })
      .returning();
    if (!row) throw new Error('Persona upsert returned no row');
    return { persona: await signedPersona(row as PersonaRecord), created: !existing };
  }

  async mutePersona(conversationId: string, mutedUntil: Date | null): Promise<PersonaDTO> {
    const [row] = await getDb()
      .update(aiPersonas)
      .set({ mutedUntil })
      .where(eq(aiPersonas.conversationId, conversationId))
      .returning();
    if (!row) throw notFound('AI member not found');
    return signedPersona(row as PersonaRecord);
  }

  async removePersona(conversationId: string): Promise<void> {
    await getDb().transaction(async (tx) => {
      await tx.delete(aiMemories).where(eq(aiMemories.conversationId, conversationId));
      await tx.delete(aiPersonas).where(eq(aiPersonas.conversationId, conversationId));
    });
  }

  async listMemories(conversationId: string): Promise<MemoryDTO[]> {
    const rows = await getDb()
      .select()
      .from(aiMemories)
      .where(and(eq(aiMemories.conversationId, conversationId), isNull(aiMemories.deletedAt)))
      .orderBy(desc(aiMemories.createdAt));
    return (rows as MemoryRecord[]).map(memoryDto);
  }

  async updateMemory(conversationId: string, memoryId: string, body: MemoryUpdateBody): Promise<MemoryDTO> {
    const [row] = await getDb()
      .update(aiMemories)
      .set({
        ...(body.summary !== undefined ? { summary: body.summary } : {}),
        ...(body.kind !== undefined ? { kind: body.kind } : {}),
        ...(body.sensitivity !== undefined ? { sensitivity: body.sensitivity } : {}),
        lastConfirmedAt: new Date(),
      })
      .where(
        and(
          eq(aiMemories.id, memoryId),
          eq(aiMemories.conversationId, conversationId),
          isNull(aiMemories.deletedAt),
        ),
      )
      .returning();
    if (!row) throw notFound('Memory not found');
    return memoryDto(row as MemoryRecord);
  }

  async deleteMemory(conversationId: string, memoryId: string): Promise<void> {
    const [row] = await getDb()
      .update(aiMemories)
      .set({ deletedAt: new Date(), embedding: null })
      .where(
        and(
          eq(aiMemories.id, memoryId),
          eq(aiMemories.conversationId, conversationId),
          isNull(aiMemories.deletedAt),
        ),
      )
      .returning({ id: aiMemories.id });
    if (!row) throw notFound('Memory not found');
  }

  async explanation(conversationId: string, messageId: string): Promise<PersonaExplanationDTO> {
    const [message] = await getDb()
      .select({ meta: messages.meta })
      .from(messages)
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.conversationId, conversationId),
          eq(messages.senderType, 'ai'),
          isNull(messages.deletedAt),
        ),
      )
      .limit(1);
    if (!message) throw notFound('AI message not found');
    const ids = Array.isArray(message.meta.memoryIdsUsed)
      ? message.meta.memoryIdsUsed.filter((id): id is string => typeof id === 'string')
      : [];
    const memories = ids.length
      ? await getDb()
          .select({ id: aiMemories.id, summary: aiMemories.summary })
          .from(aiMemories)
          .where(
            and(
              eq(aiMemories.conversationId, conversationId),
              inArray(aiMemories.id, ids),
              ne(aiMemories.sensitivity, 'high'),
              isNull(aiMemories.deletedAt),
            ),
          )
      : [];
    return {
      reason: typeof message.meta.reason === 'string' ? message.meta.reason : 'No reason recorded.',
      memories,
    };
  }

  async loadContext(conversationId: string): Promise<PersonaContext | null> {
    const persona = await this.getPersonaRecord(conversationId);
    if (!persona) return null;
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);

    const [conversationRows, memberRows, messageRows, memoryRows, aiCountRows, decisionRows] =
      await Promise.all([
        getDb()
          .select({ title: conversations.title })
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .limit(1),
        getDb()
          .select({
            userId: conversationMembers.userId,
            aiHistoryConsent: conversationMembers.aiHistoryConsent,
          })
          .from(conversationMembers)
          .where(
            and(
              eq(conversationMembers.conversationId, conversationId),
              isNull(conversationMembers.removedAt),
            ),
          ),
        getDb()
          .select({
            id: messages.id,
            conversationId: messages.conversationId,
            createdAt: messages.createdAt,
            senderType: messages.senderType,
            senderUserId: messages.senderUserId,
            body: messages.body,
            kind: messages.kind,
            mediaIds: messages.mediaIds,
            replyToId: messages.replyToId,
          })
          .from(messages)
          .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
          .orderBy(desc(messages.createdAt))
          .limit(40),
        getDb()
          .select()
          .from(aiMemories)
          .where(
            and(
              eq(aiMemories.conversationId, conversationId),
              isNull(aiMemories.deletedAt),
              ne(aiMemories.sensitivity, 'high'),
              or(isNull(aiMemories.expiresAt), gt(aiMemories.expiresAt, now)),
            ),
          )
          .orderBy(desc(aiMemories.confidence), desc(aiMemories.createdAt))
          .limit(30),
        getDb()
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conversationId),
              eq(messages.senderType, 'ai'),
              gte(messages.createdAt, dayStart),
              isNull(messages.deletedAt),
            ),
          ),
        getDb()
          .select({ intent: aiDecisions.intent })
          .from(aiDecisions)
          .where(eq(aiDecisions.conversationId, conversationId))
          .orderBy(desc(aiDecisions.at))
          .limit(5),
      ]);

    const userIds = memberRows.map((member) => member.userId);
    const accountRows = userIds.length
      ? await getDb()
          .select({ userId: socialAccounts.ownerUserId, displayName: socialAccounts.displayName })
          .from(socialAccounts)
          .where(and(inArray(socialAccounts.ownerUserId, userIds), eq(socialAccounts.type, 'personal')))
      : [];
    const names = new Map(accountRows.map((account) => [account.userId, account.displayName]));
    const transcript = messageRows
      .map(
        (message): TranscriptMessage => ({
          ...message,
          senderName:
            message.senderType === 'ai'
              ? persona.name
              : message.senderType === 'system'
                ? 'System'
                : (names.get(message.senderUserId) ?? 'Member'),
        }),
      )
      .reverse();

    return {
      conversationId,
      groupTitle: conversationRows[0]?.title ?? 'Group chat',
      persona,
      members: memberRows.map((member) => ({
        ...member,
        displayName: names.get(member.userId) ?? 'Member',
      })),
      memories: memoryRows as MemoryRecord[],
      messages: transcript,
      aiMessagesToday: Number(aiCountRows[0]?.count ?? 0),
      lastAiAt: [...transcript].reverse().find((message) => message.senderType === 'ai')?.createdAt ?? null,
      lastHumanAt:
        [...transcript].reverse().find((message) => message.senderType === 'human')?.createdAt ?? null,
      recentDecisionIntents: decisionRows
        .map((decision) => decision.intent)
        .filter((intent): intent is string => Boolean(intent)),
    };
  }

  async recordDecision(decision: DecisionRecord): Promise<void> {
    await getDb().insert(aiDecisions).values(decision);
  }

  async saveMemories(
    conversationId: string,
    memoriesToSave: Array<ExtractedMemory & { embedding: number[] }>,
  ): Promise<void> {
    for (const memory of memoriesToSave) {
      const [existing] = await getDb()
        .select({ id: aiMemories.id })
        .from(aiMemories)
        .where(
          and(
            eq(aiMemories.conversationId, conversationId),
            eq(aiMemories.kind, memory.kind),
            eq(aiMemories.summary, memory.summary),
            isNull(aiMemories.deletedAt),
          ),
        )
        .limit(1);
      if (existing) continue;
      await getDb().insert(aiMemories).values({
        id: uuidv7(),
        conversationId,
        kind: memory.kind,
        summary: memory.summary,
        sourceMessageIds: memory.sourceMessageIds,
        subjectUserIds: memory.subjectUserIds,
        sensitivity: memory.sensitivity,
        embedding: memory.embedding,
      });
    }
  }

  async upsertEvents(
    conversationId: string,
    events: Array<{
      title: string;
      kind: 'birthday' | 'outing' | 'trip' | 'game_night' | 'other';
      startsAt?: string;
      confidence: number;
      sourceMessageIds: string[];
    }>,
  ): Promise<void> {
    for (const event of events.filter(
      (candidate) => candidate.confidence >= 0.6 && candidate.sourceMessageIds.length > 0,
    )) {
      const [existing] = await getDb()
        .select({ id: eventCandidates.id })
        .from(eventCandidates)
        .where(
          and(
            eq(eventCandidates.conversationId, conversationId),
            eq(eventCandidates.title, event.title),
            eq(eventCandidates.kind, event.kind),
          ),
        )
        .limit(1);
      const values = {
        startsAt: event.startsAt ? new Date(event.startsAt) : null,
        confidence: event.confidence,
        sourceMessageIds: event.sourceMessageIds,
        state: 'tentative' as const,
      };
      if (existing) {
        await getDb().update(eventCandidates).set(values).where(eq(eventCandidates.id, existing.id));
      } else {
        await getDb()
          .insert(eventCandidates)
          .values({
            id: uuidv7(),
            conversationId,
            title: event.title,
            kind: event.kind,
            ...values,
          });
      }
    }
  }

  async enabledConversationIds(): Promise<string[]> {
    const rows = await getDb()
      .select({ conversationId: aiPersonas.conversationId })
      .from(aiPersonas)
      .where(eq(aiPersonas.enabled, true));
    return rows.map((row) => row.conversationId);
  }
}

export const personaRepository = new PersonaRepository();
