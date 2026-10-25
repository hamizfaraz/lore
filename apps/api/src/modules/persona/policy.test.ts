import { describe, expect, it } from 'vitest';
import {
  AI_SPACING_MS,
  DAILY_MESSAGE_LIMITS,
  DIRECT_THRESHOLD,
  HUMAN_TYPING_GATE_MS,
  INITIATIVE_THRESHOLDS,
  decisionThreshold,
  eligibleMemories,
  evaluateHardGates,
  finalDecisionScore,
  followsMessageStyle,
  isQuietHours,
  prefilterMessage,
  surpriseImagePermission,
  typingDelayMs,
} from './policy';
import type { MemoryRecord, PersonaContext, PersonaRecord, TranscriptMessage } from './types';

const NOW = new Date('2026-10-24T18:00:00.000Z');

function persona(overrides: Partial<PersonaRecord> = {}): PersonaRecord {
  return {
    id: 'persona-1',
    conversationId: 'conversation-1',
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
    createdByUserId: 'user-1',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

function message(overrides: Partial<TranscriptMessage> = {}): TranscriptMessage {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    createdAt: new Date(NOW.getTime() - HUMAN_TYPING_GATE_MS - 1),
    senderType: 'human',
    senderUserId: 'user-1',
    senderName: 'Alex',
    body: 'Milo, any plan for tonight?',
    kind: 'text',
    mediaIds: [],
    replyToId: null,
    ...overrides,
  };
}

function context(overrides: Partial<PersonaContext> = {}): PersonaContext {
  const source = message();
  return {
    conversationId: 'conversation-1',
    groupTitle: 'Weekend crew',
    persona: persona(),
    members: [{ userId: 'user-1', displayName: 'Alex', aiHistoryConsent: true }],
    memories: [],
    messages: [source],
    aiMessagesToday: 0,
    lastAiAt: null,
    lastHumanAt: source.createdAt,
    recentDecisionIntents: [],
    ...overrides,
  };
}

describe('persona policy gates', () => {
  it('handles quiet hours that cross midnight in the configured timezone', () => {
    const quiet = { start: '22:00', end: '07:00', tz: 'America/Chicago' };
    expect(isQuietHours(quiet, new Date('2026-10-24T04:00:00.000Z'))).toBe(true);
    expect(isQuietHours(quiet, new Date('2026-10-24T18:00:00.000Z'))).toBe(false);
  });

  it('blocks a muted persona', () => {
    const result = evaluateHardGates(
      context({ persona: persona({ mutedUntil: new Date(NOW.getTime() + 60_000) }) }),
      { direct: true, now: NOW },
    );
    expect(result).toEqual({ allowed: false, reason: 'persona muted' });
  });

  it('enforces the initiative daily budgets', () => {
    for (const initiative of ['quiet', 'balanced', 'lively'] as const) {
      const result = evaluateHardGates(
        context({
          persona: persona({ initiative }),
          aiMessagesToday: DAILY_MESSAGE_LIMITS[initiative],
        }),
        { direct: true, now: NOW },
      );
      expect(result).toMatchObject({ allowed: false, reason: 'daily message budget reached' });
    }
  });

  it('keeps ten minutes between AI messages unless directly invoked', () => {
    const recent = context({ lastAiAt: new Date(NOW.getTime() - AI_SPACING_MS + 1) });
    expect(evaluateHardGates(recent, { direct: false, now: NOW }).allowed).toBe(false);
    expect(evaluateHardGates(recent, { direct: true, now: NOW }).allowed).toBe(true);
  });

  it('keeps the twenty-second human typing gate even for direct invocations', () => {
    const recent = context({ lastHumanAt: new Date(NOW.getTime() - HUMAN_TYPING_GATE_MS + 1) });
    expect(evaluateHardGates(recent, { direct: true, now: NOW })).toMatchObject({
      allowed: false,
      reason: 'human typing window',
    });
  });

  it('detects name invocation and social intent before a model call', () => {
    const result = prefilterMessage(context(), message(), { now: NOW });
    expect(result.direct).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['directly invoked', 'group question', 'social intent']),
    );
  });
});

describe('persona score and permissions', () => {
  it('uses the documented initiative and direct thresholds', () => {
    expect(INITIATIVE_THRESHOLDS).toEqual({ quiet: 0.8, balanced: 0.65, lively: 0.5 });
    expect(decisionThreshold('quiet', true)).toBe(DIRECT_THRESHOLD);
    expect(decisionThreshold('lively', false)).toBe(0.5);
  });

  it('calculates the deterministic weighted score and penalties', () => {
    expect(
      finalDecisionScore({
        model: 0.8,
        novelty: 0.5,
        receptivity: 0.75,
        timing: 1,
        guard: { allow: true, category: 'harassment', severity: 1 },
        surpriseImageOverBudget: true,
      }),
    ).toBe(0.26);
  });

  it('filters deleted, expired, and high-sensitivity memories', () => {
    const base: MemoryRecord = {
      id: 'memory-1',
      conversationId: 'conversation-1',
      kind: 'fact',
      summary: 'Alex likes board games',
      sourceMessageIds: [],
      subjectUserIds: ['user-1'],
      sensitivity: 'low',
      confidence: 0.9,
      lastConfirmedAt: null,
      expiresAt: null,
      deletedAt: null,
      createdAt: NOW,
    };
    expect(
      eligibleMemories(
        [
          base,
          { ...base, id: 'high', sensitivity: 'high' },
          { ...base, id: 'deleted', deletedAt: NOW },
          { ...base, id: 'expired', expiresAt: new Date(NOW.getTime() - 1) },
        ],
        NOW,
      ).map((memory) => memory.id),
    ).toEqual(['memory-1']);
  });

  it('requires both image permission and remaining weekly budget', () => {
    expect(
      surpriseImagePermission({ allowImages: false, requested: true, weeklyBudgetAllowed: true }),
    ).toMatchObject({ allowed: false, overBudget: false });
    expect(
      surpriseImagePermission({ allowImages: true, requested: true, weeklyBudgetAllowed: false }),
    ).toMatchObject({ allowed: false, overBudget: true });
    expect(
      surpriseImagePermission({ allowImages: true, requested: true, weeklyBudgetAllowed: true }),
    ).toMatchObject({ allowed: true, overBudget: false });
  });

  it('uses the required capped human-like typing delay', () => {
    expect(typingDelayMs(10)).toBe(1_800);
    expect(typingDelayMs(10_000)).toBe(6_000);
  });

  it('enforces message length, hashtag, and one-emoji house rules', () => {
    expect(followsMessageStyle('one useful thought 🙂')).toBe(true);
    expect(followsMessageStyle('too much 🙂 🎉')).toBe(false);
    expect(followsMessageStyle('join us #weekend')).toBe(false);
    expect(followsMessageStyle('x'.repeat(281))).toBe(false);
  });
});
