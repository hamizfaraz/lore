import type { SpeakDecision } from '@lore/shared/ai';
import { describe, expect, it, vi } from 'vitest';
import { buildPersonaPrompt, createPersonaServiceForTest, normalizeExtractedMemories } from './service';
import type { Membership } from './repository';
import type { PersonaContext, PersonaRecord, TranscriptMessage } from './types';

const NOW = new Date('2026-10-24T18:00:00.000Z');

function persona(overrides: Partial<PersonaRecord> = {}): PersonaRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    conversationId: '00000000-0000-4000-8000-000000000002',
    name: 'Milo',
    avatarMediaId: null,
    tone: ['warm'],
    interests: [],
    boundaries: null,
    initiative: 'balanced',
    quietHours: null,
    allowHistory: true,
    allowNews: true,
    allowImages: true,
    allowPlans: true,
    allowLocation: false,
    surpriseImagesPerWeek: 1,
    enabled: true,
    mutedUntil: null,
    createdByUserId: '00000000-0000-4000-8000-000000000003',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

function message(overrides: Partial<TranscriptMessage> = {}): TranscriptMessage {
  return {
    id: '00000000-0000-4000-8000-000000000004',
    conversationId: '00000000-0000-4000-8000-000000000002',
    createdAt: new Date(NOW.getTime() - 21_000),
    senderType: 'human',
    senderUserId: '00000000-0000-4000-8000-000000000003',
    senderName: 'Alex',
    body: 'Milo, what should we plan tonight?',
    kind: 'text',
    mediaIds: [],
    replyToId: null,
    ...overrides,
  };
}

function context(overrides: Partial<PersonaContext> = {}): PersonaContext {
  const source = message();
  return {
    conversationId: source.conversationId,
    groupTitle: 'Weekend crew',
    persona: persona(),
    members: [
      { userId: source.senderUserId!, displayName: 'Alex', aiHistoryConsent: true },
      {
        userId: '00000000-0000-4000-8000-000000000005',
        displayName: 'Sam',
        aiHistoryConsent: false,
      },
    ],
    memories: [],
    messages: [source],
    aiMessagesToday: 0,
    lastAiAt: null,
    lastHumanAt: source.createdAt,
    recentDecisionIntents: [],
    ...overrides,
  };
}

function decision(overrides: Partial<SpeakDecision> = {}): SpeakDecision {
  return {
    speak: true,
    intent: 'reply',
    score: 0.9,
    reason: 'directly asked for a useful idea',
    message: 'movie night and homemade pizza could be a good low-key combo',
    memoryIdsUsed: [],
    newMemories: [],
    events: [],
    ...overrides,
  };
}

function fakeStore(ctx: PersonaContext) {
  return {
    membership: vi.fn(async (): Promise<Membership> => ({ role: 'admin', aiHistoryConsent: true })),
    getPersona: vi.fn(async () => null),
    upsertPersona: vi.fn(),
    mutePersona: vi.fn(),
    removePersona: vi.fn(),
    listMemories: vi.fn(async () => []),
    updateMemory: vi.fn(),
    deleteMemory: vi.fn(),
    explanation: vi.fn(),
    loadContext: vi.fn(async () => ctx),
    recordDecision: vi.fn(async () => undefined),
    saveMemories: vi.fn(async () => undefined),
    upsertEvents: vi.fn(async () => undefined),
    enabledConversationIds: vi.fn(async () => [ctx.conversationId]),
  };
}

describe('persona prompt privacy', () => {
  it('keeps fixed prompt order, hides opted-out history, and drops cross-conversation messages', () => {
    const hidden = message({
      id: '00000000-0000-4000-8000-000000000006',
      senderUserId: '00000000-0000-4000-8000-000000000005',
      senderName: 'Sam',
      body: 'private preference',
    });
    const crossConversation = message({
      id: '00000000-0000-4000-8000-000000000007',
      conversationId: '00000000-0000-4000-8000-000000000099',
      body: 'must never leak',
    });
    const ctx = context({ messages: [hidden, crossConversation, message()] });
    const prompt = buildPersonaPrompt(ctx, message().id, NOW);
    expect(prompt.messages.map((item) => String(item.content).split('\n')[0])).toEqual([
      expect.stringContaining('You are Milo'),
      'GROUP',
      'MEMORIES',
      'ACTIVITY',
      'TRANSCRIPT',
    ]);
    const transcript = String(prompt.messages.at(-1)?.content);
    expect(transcript).toContain('[message hidden from AI]');
    expect(transcript).not.toContain('private preference');
    expect(transcript).not.toContain('must never leak');
  });

  it('discards high-sensitivity extracted memories', () => {
    const memories = normalizeExtractedMemories(
      decision({
        newMemories: [
          { kind: 'fact', summary: 'safe fact', subjectUserIds: [], sensitivity: 'low' },
          { kind: 'fact', summary: 'private fact', subjectUserIds: [], sensitivity: 'high' },
        ],
      }),
      message().id,
    );
    expect(memories.map((memory) => memory.summary)).toEqual(['safe fact']);
  });
});

describe('persona decision service', () => {
  it('posts a grounded direct response with typing state and a decision log', async () => {
    const ctx = context();
    const store = fakeStore(ctx);
    const post = vi.fn(async () => ({ id: 'posted' }));
    const typing: boolean[] = [];
    const service = createPersonaServiceForTest({
      store,
      now: () => NOW,
      sleep: async () => undefined,
      consumeTextBudget: async () => true,
      consumeSurpriseBudget: async () => true,
      decide: async () => ({ data: decision(), degraded: false, model: 'mock', attempts: 0 }),
      guard: async () => ({ allow: true, category: 'ok', severity: 0 }),
      post: post as never,
      emitTyping: (_conversationId, _personaId, on) => typing.push(on),
    });
    const result = await service.consider({
      conversationId: ctx.conversationId,
      trigger: 'message',
      sourceMessageId: ctx.messages[0]!.id,
      requestId: 'request-1',
    });
    expect(result.spoke).toBe(true);
    expect(post).toHaveBeenCalledOnce();
    expect(typing).toEqual([true, false]);
    expect(store.recordDecision).toHaveBeenCalledWith(
      expect.objectContaining({ speak: true, intent: 'reply' }),
    );
  });

  it('forces silence for news without an input candidate', async () => {
    const ctx = context();
    const store = fakeStore(ctx);
    const post = vi.fn();
    const service = createPersonaServiceForTest({
      store,
      now: () => NOW,
      consumeTextBudget: async () => true,
      decide: async () => ({
        data: decision({ intent: 'news', candidateId: 'invented-candidate' }),
        degraded: false,
        model: 'mock',
        attempts: 0,
      }),
      guard: async () => ({ allow: true, category: 'ok', severity: 0 }),
      post: post as never,
    });
    const result = await service.consider({
      conversationId: ctx.conversationId,
      trigger: 'message',
      sourceMessageId: ctx.messages[0]!.id,
    });
    expect(result.spoke).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('treats a reply to the persona as a direct override of the ten-minute spacing gate', async () => {
    const aiMessage = message({
      id: '00000000-0000-4000-8000-000000000008',
      senderType: 'ai',
      senderUserId: null,
      senderName: 'Milo',
      body: 'want a few ideas?',
      createdAt: new Date(NOW.getTime() - 5 * 60_000),
    });
    const reply = message({
      body: 'yes please',
      replyToId: aiMessage.id,
    });
    const ctx = context({
      messages: [aiMessage, reply],
      lastAiAt: aiMessage.createdAt,
      lastHumanAt: reply.createdAt,
    });
    const store = fakeStore(ctx);
    const post = vi.fn(async () => ({ id: 'posted' }));
    const service = createPersonaServiceForTest({
      store,
      now: () => NOW,
      sleep: async () => undefined,
      consumeTextBudget: async () => true,
      decide: async () => ({ data: decision(), degraded: false, model: 'mock', attempts: 0 }),
      guard: async () => ({ allow: true, category: 'ok', severity: 0 }),
      post: post as never,
      emitTyping: () => undefined,
    });
    const result = await service.consider({
      conversationId: ctx.conversationId,
      trigger: 'message',
      sourceMessageId: reply.id,
    });
    expect(result.spoke).toBe(true);
    expect(post).toHaveBeenCalledOnce();
  });

  it('requires an admin to add or change the AI member', async () => {
    const ctx = context();
    const store = fakeStore(ctx);
    store.membership.mockResolvedValue({ role: 'member', aiHistoryConsent: true });
    const service = createPersonaServiceForTest({ store });
    await expect(service.updatePersona(ctx.conversationId, 'user-1', { name: 'Milo' })).rejects.toMatchObject(
      { code: 'FORBIDDEN' },
    );
    expect(store.upsertPersona).not.toHaveBeenCalled();
  });

  it('posts the disclosure system message when a persona joins', async () => {
    const ctx = context();
    const store = fakeStore(ctx);
    const dto = {
      id: ctx.persona.id,
      conversationId: ctx.conversationId,
      name: 'Milo',
      avatarUrl: null,
      tone: ['warm'],
      interests: [],
      boundaries: null,
      initiative: 'balanced' as const,
      quietHours: null,
      allowHistory: true,
      allowNews: true,
      allowImages: true,
      allowPlans: true,
      allowLocation: false,
      surpriseImagesPerWeek: 1,
      enabled: true,
      mutedUntil: null,
    };
    store.upsertPersona.mockResolvedValue({ persona: dto, created: true });
    const post = vi.fn(async () => ({ id: 'disclosure' }));
    const service = createPersonaServiceForTest({ store, post: post as never });
    await service.updatePersona(ctx.conversationId, 'user-1', { name: 'Milo' });
    expect(post).toHaveBeenCalledWith(
      ctx.conversationId,
      expect.objectContaining({ kind: 'system', body: expect.stringContaining('AI member') }),
      { type: 'system' },
    );
  });

  it('queues human messages after the twenty-second typing window', async () => {
    const queued = vi.fn(async () => undefined);
    const service = createPersonaServiceForTest({ enqueueConsider: queued });
    await service.onMessage({
      id: message().id,
      conversationId: context().conversationId,
      clientId: null,
      createdAt: NOW.toISOString(),
      senderType: 'human',
      sender: { userId: 'user', displayName: 'Alex', handle: null, avatarUrl: null },
      persona: null,
      kind: 'text',
      body: 'hello',
      media: [],
      cardKind: null,
      cardRefId: null,
      replyTo: null,
      aiGenerated: false,
      meta: {},
      reactions: [],
      editedAt: null,
      deletedAt: null,
    });
    expect(queued).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'message' }), 20_500);
  });
});
