import type { GuardVerdict } from '@lore/shared/ai';
import type { Initiative } from '@lore/shared/enums';
import type { MemoryRecord, PersonaContext, QuietHours, TranscriptMessage } from './types';

export const DAILY_MESSAGE_LIMITS: Record<Initiative, number> = {
  quiet: 3,
  balanced: 8,
  lively: 15,
};

export const INITIATIVE_THRESHOLDS: Record<Initiative, number> = {
  quiet: 0.8,
  balanced: 0.65,
  lively: 0.5,
};

export const DIRECT_THRESHOLD = 0.3;
export const AI_SPACING_MS = 10 * 60 * 1_000;
export const HUMAN_TYPING_GATE_MS = 20 * 1_000;

export type PrefilterResult = {
  eligible: boolean;
  direct: boolean;
  reasons: string[];
};

export type GateResult = { allowed: true } | { allowed: false; reason: string; retryAfterMs?: number };

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function minutesInTimeZone(at: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
  } catch {
    return null;
  }
}

export function isQuietHours(quietHours: QuietHours | null, at = new Date()): boolean {
  if (!quietHours) return false;
  const start = parseClock(quietHours.start);
  const end = parseClock(quietHours.end);
  const now = minutesInTimeZone(at, quietHours.tz);
  if (start === null || end === null || now === null || start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

function stableFraction(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

function directlyInvoked(message: TranscriptMessage | undefined, personaName: string): boolean {
  if (!message) return false;
  const body = message.body ?? '';
  const name = personaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s|@)${name}(?:$|\\s|[,.!?])`, 'i').test(body);
}

export function prefilterMessage(
  context: PersonaContext,
  message: TranscriptMessage | undefined,
  options: { requested?: boolean; now?: Date } = {},
): PrefilterResult {
  const reasons: string[] = [];
  const direct = Boolean(options.requested) || directlyInvoked(message, context.persona.name);
  if (direct) reasons.push('directly invoked');

  const body = message?.body?.toLocaleLowerCase() ?? '';
  if (body.includes('?')) reasons.push('group question');
  if (/\b(plan|watch|meet|birthday|bored|weekend|tonight)\b/i.test(body)) reasons.push('social intent');
  if (message && (message.kind === 'voice' || message.mediaIds.length > 0)) reasons.push('media input');

  if (!message) {
    const lastHumanAt = context.lastHumanAt?.getTime() ?? 0;
    const quietForMs = (options.now ?? new Date()).getTime() - lastHumanAt;
    if (quietForMs >= 2 * 60 * 60 * 1_000 && context.memories.length > 0) {
      reasons.push('relevant opportunity after prolonged silence');
    }
  } else if (
    context.persona.initiative === 'lively' &&
    stableFraction(`${context.conversationId}:${message.id}`) < 0.15
  ) {
    reasons.push('lively sample');
  }

  return { eligible: reasons.length > 0, direct, reasons };
}

export function evaluateHardGates(
  context: PersonaContext,
  options: { direct: boolean; providerBudgetAllowed?: boolean; now?: Date },
): GateResult {
  const now = options.now ?? new Date();
  if (!context.persona.enabled) return { allowed: false, reason: 'persona disabled' };
  if (context.persona.mutedUntil && context.persona.mutedUntil > now) {
    return { allowed: false, reason: 'persona muted' };
  }
  if (isQuietHours(context.persona.quietHours, now)) {
    return { allowed: false, reason: 'quiet hours' };
  }
  if (context.aiMessagesToday >= DAILY_MESSAGE_LIMITS[context.persona.initiative]) {
    return { allowed: false, reason: 'daily message budget reached' };
  }
  if (options.providerBudgetAllowed === false) {
    return { allowed: false, reason: 'hourly AI budget reached' };
  }
  if (!options.direct && context.lastAiAt) {
    const elapsed = now.getTime() - context.lastAiAt.getTime();
    if (elapsed < AI_SPACING_MS) {
      return { allowed: false, reason: 'AI spacing window', retryAfterMs: AI_SPACING_MS - elapsed };
    }
  }
  if (context.lastHumanAt) {
    const elapsed = now.getTime() - context.lastHumanAt.getTime();
    if (elapsed < HUMAN_TYPING_GATE_MS) {
      return { allowed: false, reason: 'human typing window', retryAfterMs: HUMAN_TYPING_GATE_MS - elapsed };
    }
  }
  return { allowed: true };
}

export function scoreComponents(context: PersonaContext, intent: string, direct: boolean, now = new Date()) {
  const novelty = context.recentDecisionIntents.includes(intent) ? 0.25 : 1;
  const messages = context.messages.filter((message) => message.senderType !== 'system');
  const humanCount = messages.filter((message) => message.senderType === 'human').length;
  const aiCount = messages.filter((message) => message.senderType === 'ai').length;
  const receptivity = direct ? 1 : Math.max(0.35, Math.min(1, humanCount / Math.max(1, aiCount * 4)));
  const silenceMs = context.lastHumanAt ? now.getTime() - context.lastHumanAt.getTime() : 60_000;
  const timing = direct ? 1 : Math.max(0.35, Math.min(1, silenceMs / (5 * 60 * 1_000)));
  return { novelty, receptivity, timing };
}

export function finalDecisionScore(input: {
  model: number;
  novelty: number;
  receptivity: number;
  timing: number;
  guard: GuardVerdict;
  surpriseImageOverBudget: boolean;
}): number {
  const penalties = (input.guard.severity >= 1 ? 0.3 : 0) + (input.surpriseImageOverBudget ? 0.2 : 0);
  const score =
    0.45 * input.model + 0.2 * input.novelty + 0.2 * input.receptivity + 0.15 * input.timing - penalties;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

export function decisionThreshold(initiative: Initiative, direct: boolean): number {
  return direct ? DIRECT_THRESHOLD : INITIATIVE_THRESHOLDS[initiative];
}

export function typingDelayMs(characters: number): number {
  return Math.min(6_000, 1_500 + Math.max(0, characters) * 30);
}

export function followsMessageStyle(message: string): boolean {
  const emojiCount = message.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
  return message.length <= 280 && emojiCount <= 1 && !/(^|\s)#[\p{L}\p{N}_]+/u.test(message);
}

export function eligibleMemories(memories: MemoryRecord[], now = new Date()): MemoryRecord[] {
  return memories.filter(
    (memory) =>
      !memory.deletedAt && memory.sensitivity !== 'high' && (!memory.expiresAt || memory.expiresAt > now),
  );
}

export function surpriseImagePermission(input: {
  allowImages: boolean;
  requested: boolean;
  weeklyBudgetAllowed: boolean;
}): { allowed: boolean; overBudget: boolean; reason?: string } {
  if (!input.requested) return { allowed: false, overBudget: false };
  if (!input.allowImages) return { allowed: false, overBudget: false, reason: 'image permission disabled' };
  if (!input.weeklyBudgetAllowed) {
    return { allowed: false, overBudget: true, reason: 'weekly surprise image budget reached' };
  }
  return { allowed: true, overBudget: false };
}
