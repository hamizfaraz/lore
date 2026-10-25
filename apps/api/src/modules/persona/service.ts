import {
  AiBudget,
  InMemoryCounterStore,
  ValkeyCounterStore,
  buildPersonaSystemPrompt,
  callStructured,
  embedTexts,
  generateMuseImage,
  guardText,
  sanitizeSpeakDecision,
  withHouseImageStyle,
} from '@lore/ai';
import { SpeakDecision, type GuardVerdict, type SpeakDecision as SpeakDecisionType } from '@lore/shared/ai';
import type { MessageDTO } from '@lore/shared/dto/chat';
import type {
  MemoryDTO,
  MemoryUpdateBody,
  PersonaDTO,
  PersonaExplanationDTO,
  PersonaMuteBody,
  PersonaTestBody,
  PersonaTestResponse,
  PersonaUpdateBody,
  PersonaAvatarOptionDTO,
  PersonaAvatarSelectionDTO,
} from '@lore/shared/dto/persona';
import type { AiImageCardDTO } from '@lore/shared/dto/persona';
import { postMessage } from '../chat/service';
import { createFromBuffer, getRow, signedUrl } from '../media/service';
import { recordImpactEvent } from '../impact/service';
import { forbidden } from '../../lib/errors';
import { env } from '../../lib/env';
import { enqueue } from '../../lib/queues';
import { getRedis } from '../../lib/redis';
import { emitPersonaTyping } from './events';
import {
  decisionThreshold,
  eligibleMemories,
  evaluateHardGates,
  finalDecisionScore,
  followsMessageStyle,
  prefilterMessage,
  scoreComponents,
  surpriseImagePermission,
  typingDelayMs,
} from './policy';
import { PersonaRepository, personaRepository } from './repository';
import type {
  ConsiderInput,
  DecisionRecord,
  ExtractedMemory,
  PersonaContext,
  TranscriptMessage,
} from './types';

const DISCLOSURE = (persona: PersonaDTO) =>
  `${persona.name} joined as an AI member. Everyone in this chat can see when a message is AI-generated. ${persona.name} may use permitted chat history and shared memories to help, stays within the group's privacy settings, and can be muted or removed at any time.`;

const systemActor = { type: 'system' as const };

type PersonaStore = Pick<
  PersonaRepository,
  | 'membership'
  | 'getPersona'
  | 'upsertPersona'
  | 'mutePersona'
  | 'removePersona'
  | 'listMemories'
  | 'updateMemory'
  | 'deleteMemory'
  | 'explanation'
  | 'loadContext'
  | 'recordDecision'
  | 'saveMemories'
  | 'upsertEvents'
  | 'enabledConversationIds'
>;

type PersonaDependencies = {
  store: PersonaStore;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  enqueueConsider: (input: ConsiderInput, delayMs: number) => Promise<unknown>;
  consumeTextBudget: (conversationId: string) => Promise<boolean>;
  consumeSurpriseBudget: (conversationId: string, limit: number) => Promise<boolean>;
  decide: (
    messages: PersonaPromptMessage[],
    mockValue?: SpeakDecisionType,
  ) => Promise<{
    data: SpeakDecisionType;
    degraded: boolean;
    model: string;
    attempts: number;
  }>;
  guard: (text: string) => Promise<GuardVerdict>;
  embed: (texts: string[]) => Promise<number[][]>;
  post: typeof postMessage;
  emitTyping: (conversationId: string, personaId: string, on: boolean) => void;
  createImage: typeof generateMuseImage;
  storeImage: typeof createFromBuffer;
  impact?: typeof recordImpactEvent;
};

type PersonaPromptMessage = { role: 'system' | 'user'; content: string };
type AvatarStyle = PersonaAvatarOptionDTO['style'];

const AVATAR_STYLES: Array<{ style: AvatarStyle; label: string; prompt: string }> = [
  { style: 'warm', label: 'Warm guide', prompt: 'a friendly glowing house spirit, coral scarf, calm smile' },
  {
    style: 'playful',
    label: 'Playful spark',
    prompt: 'a playful rounded helper spirit, bouncing star shapes, joyful energy',
  },
  {
    style: 'minimal',
    label: 'Quiet orbit',
    prompt: 'a minimal geometric companion, soft cream circle and navy orbit',
  },
  {
    style: 'cosmic',
    label: 'Cosmic pal',
    prompt: 'a tiny cosmic companion made of gentle starlight and sage clouds',
  },
];

const avatarPrompt = (style: AvatarStyle, name: string) => {
  const option = AVATAR_STYLES.find((item) => item.style === style)!;
  return withHouseImageStyle(
    `Square avatar portrait for the AI group member named ${name}. ${option.prompt}. No text.`,
  );
};

const dataUrl = (bytes: Buffer, mime: string) => `data:${mime};base64,${bytes.toString('base64')}`;

let textBudget: AiBudget | undefined;
const surpriseBudgets = new Map<number, AiBudget>();

function defaultTextBudget(): AiBudget {
  textBudget ??= new AiBudget(new ValkeyCounterStore(getRedis()));
  return textBudget;
}

function defaultSurpriseBudget(limit: number): AiBudget {
  let budget = surpriseBudgets.get(limit);
  if (!budget) {
    budget = new AiBudget(new ValkeyCounterStore(getRedis()), {
      textCallsPerConversationPerHour: 60,
      imagesPerHourGlobal: 40,
      surpriseImagesPerConversationPerWeek: limit,
    });
    surpriseBudgets.set(limit, budget);
  }
  return budget;
}

const defaultDependencies: PersonaDependencies = {
  store: personaRepository,
  now: () => new Date(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  enqueueConsider: (input, delayMs) =>
    enqueue('persona.consider', input, {
      debounceKey: input.conversationId,
      delayMs,
      jobId: (input.requestId ?? input.sourceMessageId)?.replaceAll(':', '-'),
    }),
  consumeTextBudget: async (conversationId) =>
    (await defaultTextBudget().consumeText(conversationId)).allowed,
  consumeSurpriseBudget: async (conversationId, limit) =>
    (await defaultSurpriseBudget(limit).consumeSurpriseImage(conversationId)).allowed,
  decide: (messages, mockValue) =>
    callStructured(SpeakDecision, messages, {
      name: 'speakDecision',
      reasoningEffort: 'minimal',
      timeoutMs: 8_000,
      ...(mockValue ? { mockValue } : {}),
    }),
  guard: (text) => guardText(text),
  embed: (texts) => embedTexts(texts),
  post: postMessage,
  emitTyping: emitPersonaTyping,
  createImage: generateMuseImage,
  storeImage: createFromBuffer,
  impact: recordImpactEvent,
};

function cleanWords(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 3),
  );
}

export function rankMemories(context: PersonaContext, query: string, now = new Date()) {
  const queryWords = cleanWords(query);
  const consent = new Map(context.members.map((member) => [member.userId, member.aiHistoryConsent]));
  return eligibleMemories(context.memories, now)
    .filter((memory) => memory.subjectUserIds.every((userId) => consent.get(userId) !== false))
    .map((memory) => {
      const words = cleanWords(memory.summary);
      const overlap = [...queryWords].filter((word) => words.has(word)).length;
      const recency = Math.max(0, 1 - (now.getTime() - memory.createdAt.getTime()) / (180 * 86_400_000));
      return { memory, relevance: overlap * 2 + memory.confidence + recency * 0.2 };
    })
    .sort((a, b) => b.relevance - a.relevance || a.memory.id.localeCompare(b.memory.id))
    .slice(0, 6)
    .map(({ memory }) => memory);
}

export function buildPersonaPrompt(
  context: PersonaContext,
  sourceMessageId?: string,
  now = new Date(),
): { messages: PersonaPromptMessage[]; memories: ReturnType<typeof rankMemories> } {
  const scopedMessages = context.messages
    .filter((message) => message.conversationId === context.conversationId)
    .slice(-40);
  const source = scopedMessages.find((message) => message.id === sourceMessageId);
  const query = source?.body ?? scopedMessages.at(-1)?.body ?? '';
  const memories = rankMemories(context, query, now);
  const consent = new Map(context.members.map((member) => [member.userId, member.aiHistoryConsent]));
  const transcript = scopedMessages.map((message) => {
    const mayRead =
      message.senderType !== 'human' ||
      (context.persona.allowHistory && consent.get(message.senderUserId ?? '') !== false) ||
      message.id === sourceMessageId;
    const body = mayRead ? (message.body ?? `[${message.kind}]`) : '[message hidden from AI]';
    return `${message.id} · ${message.senderName}: ${body}`;
  });
  const lastHumanAgo = context.lastHumanAt
    ? Math.max(0, Math.round((now.getTime() - context.lastHumanAt.getTime()) / 1_000))
    : null;

  return {
    memories,
    messages: [
      { role: 'system', content: buildPersonaSystemPrompt(context.persona.name) },
      {
        role: 'user',
        content: [
          'GROUP',
          `title: ${context.groupTitle}`,
          `members: ${context.members.map((member) => member.displayName).join(', ')}`,
          `initiative: ${context.persona.initiative}`,
          `tone: ${context.persona.tone.join(', ')}`,
          `interests: ${context.persona.interests.join(', ') || 'none configured'}`,
          `boundaries: ${context.persona.boundaries ?? 'standard house rules'}`,
          `permissions: history=${context.persona.allowHistory}, news=${context.persona.allowNews}, images=${context.persona.allowImages}, plans=${context.persona.allowPlans}, location=${context.persona.allowLocation}`,
        ].join('\n'),
      },
      {
        role: 'user',
        content: `MEMORIES\n${memories.length ? memories.map((memory) => `${memory.id}: ${memory.summary}`).join('\n') : 'none'}`,
      },
      {
        role: 'user',
        content: [
          'ACTIVITY',
          `ai messages today: ${context.aiMessagesToday}`,
          `seconds since last human message: ${lastHumanAgo ?? 'unknown'}`,
          `recent AI intents: ${context.recentDecisionIntents.join(', ') || 'none'}`,
        ].join('\n'),
      },
      { role: 'user', content: `TRANSCRIPT\n${transcript.join('\n') || 'no messages'}` },
    ],
  };
}

export function normalizeExtractedMemories(
  decision: SpeakDecisionType,
  sourceMessageId: string | undefined,
): ExtractedMemory[] {
  return decision.newMemories
    .filter((memory) => memory.sensitivity !== 'high' && memory.summary.trim().length > 0)
    .map((memory) => ({
      ...memory,
      summary: memory.summary.trim(),
      sourceMessageIds: sourceMessageId ? [sourceMessageId] : [],
    }));
}

function isReplyToPersona(context: PersonaContext, source: TranscriptMessage | undefined): boolean {
  if (!source?.replyToId) return false;
  return context.messages.some((message) => message.id === source.replyToId && message.senderType === 'ai');
}

function decisionRecord(
  input: ConsiderInput,
  values: Omit<DecisionRecord, 'conversationId' | 'trigger'>,
): DecisionRecord {
  return { conversationId: input.conversationId, trigger: input.trigger, ...values };
}

export class PersonaService {
  constructor(private readonly deps: PersonaDependencies = defaultDependencies) {}

  private async requireMember(conversationId: string, userId: string) {
    const membership = await this.deps.store.membership(conversationId, userId);
    if (!membership) throw forbidden('You are not a member of this conversation');
    return membership;
  }

  private async requireAdmin(conversationId: string, userId: string) {
    const membership = await this.requireMember(conversationId, userId);
    if (membership.role !== 'primary_admin' && membership.role !== 'admin') {
      throw forbidden('Only a group admin can change the AI member');
    }
    return membership;
  }

  async getPersona(conversationId: string, userId: string): Promise<PersonaDTO | null> {
    await this.requireMember(conversationId, userId);
    return this.deps.store.getPersona(conversationId);
  }

  async updatePersona(conversationId: string, userId: string, body: PersonaUpdateBody): Promise<PersonaDTO> {
    await this.requireAdmin(conversationId, userId);
    const result = await this.deps.store.upsertPersona(conversationId, userId, body);
    if (result.created) {
      await this.deps.post(
        conversationId,
        { kind: 'system', body: DISCLOSURE(result.persona), clientId: `persona-joined:${result.persona.id}` },
        systemActor,
      );
    }
    return result.persona;
  }

  async mutePersona(conversationId: string, userId: string, body: PersonaMuteBody): Promise<PersonaDTO> {
    await this.requireAdmin(conversationId, userId);
    const now = this.deps.now();
    const mutedUntil =
      body.duration === 'unmute'
        ? null
        : body.duration === 'until_unmuted'
          ? new Date('9999-12-31T23:59:59.999Z')
          : new Date(now.getTime() + (body.duration === 'one_hour' ? 60 : 480) * 60_000);
    const persona = await this.deps.store.mutePersona(conversationId, mutedUntil);
    if (body.duration !== 'unmute') {
      await this.deps
        .impact?.({
          kind: 'ai_muted',
          groupId: conversationId,
          actorId: userId,
          props: { duration: body.duration },
        })
        .catch(() => undefined);
    }
    return persona;
  }

  async removePersona(conversationId: string, userId: string): Promise<void> {
    await this.requireAdmin(conversationId, userId);
    await this.deps.store.removePersona(conversationId);
  }

  async listMemories(conversationId: string, userId: string): Promise<MemoryDTO[]> {
    await this.requireMember(conversationId, userId);
    return this.deps.store.listMemories(conversationId);
  }

  async updateMemory(
    conversationId: string,
    memoryId: string,
    userId: string,
    body: MemoryUpdateBody,
  ): Promise<MemoryDTO> {
    await this.requireMember(conversationId, userId);
    return this.deps.store.updateMemory(conversationId, memoryId, body);
  }

  async deleteMemory(conversationId: string, memoryId: string, userId: string): Promise<void> {
    await this.requireMember(conversationId, userId);
    await this.deps.store.deleteMemory(conversationId, memoryId);
  }

  async explanation(
    conversationId: string,
    messageId: string,
    userId: string,
  ): Promise<PersonaExplanationDTO> {
    await this.requireMember(conversationId, userId);
    return this.deps.store.explanation(conversationId, messageId);
  }

  async testPersona(
    conversationId: string,
    userId: string,
    body: PersonaTestBody,
  ): Promise<PersonaTestResponse> {
    await this.requireMember(conversationId, userId);
    const name =
      body.name ?? (body.preset === 'juniper' ? 'Juniper' : body.preset === 'sol' ? 'Sol' : 'Milo');
    const scenarios = [
      { label: 'Direct reply', transcript: body.samplePrompt ?? 'any ideas for something fun this weekend?' },
      { label: 'Helpful plan', transcript: 'we need a low-key plan that works for everyone' },
      { label: 'Knowing when to pause', transcript: 'okay, we have it handled from here' },
    ];
    const results = await Promise.all(
      scenarios.map(({ label, transcript }) =>
        this.deps.decide([
          { role: 'system', content: buildPersonaSystemPrompt(name) },
          {
            role: 'user',
            content: `Preview only. Do not join the chat, extract memories, or write data. SCENARIO: ${label}\nGROUP\ninitiative: ${body.initiative ?? 'balanced'}\ntone: ${(body.tone ?? ['warm', 'brief']).join(', ')}\nboundaries: ${body.boundaries ?? 'standard house rules'}\nTRANSCRIPT\nMember: ${transcript}`,
          },
        ]),
      ),
    );
    return {
      previews: results.map((result, index) => ({
        message: result.data.message ?? `${name} would stay quiet here.`,
        reason: `${scenarios[index]!.label}: ${result.data.reason}`.slice(0, 140),
      })),
      degraded: results.some((result) => result.degraded),
    };
  }

  async avatarOptions(
    conversationId: string,
    userId: string,
  ): Promise<{ options: PersonaAvatarOptionDTO[] }> {
    await this.requireAdmin(conversationId, userId);
    const persona = await this.deps.store.getPersona(conversationId);
    const name = persona?.name ?? 'Milo';
    const images = await Promise.all(
      AVATAR_STYLES.map(async (option) => {
        const image = await this.deps.createImage({
          prompt: avatarPrompt(option.style, name),
          size: '512x512',
          user: userId,
        });
        return {
          style: option.style,
          label: option.label,
          imageUrl: dataUrl(image.bytes, image.mime),
          generator: image.model,
          degraded: image.degraded,
        };
      }),
    );
    return { options: images };
  }

  async selectAvatar(
    conversationId: string,
    userId: string,
    style: AvatarStyle,
  ): Promise<PersonaAvatarSelectionDTO> {
    await this.requireAdmin(conversationId, userId);
    const persona = await this.deps.store.getPersona(conversationId);
    const image = await this.deps.createImage({
      prompt: avatarPrompt(style, persona?.name ?? 'Milo'),
      size: '512x512',
      user: userId,
    });
    let mediaId: string | null = null;
    try {
      mediaId = (
        await this.deps.storeImage(image.bytes, {
          ownerUserId: userId,
          kind: 'generated_image',
          mime: image.mime,
          aiGenerated: true,
          generator: image.model,
          width: 512,
          height: 512,
          captionAi: `AI-generated ${style} avatar for ${persona?.name ?? 'Milo'}`,
        })
      ).id;
    } catch (error) {
      if (env.NODE_ENV === 'production') throw error;
    }
    return {
      mediaId,
      imageUrl: dataUrl(image.bytes, image.mime),
      generator: image.model,
      degraded: image.degraded,
    };
  }

  async onMessage(message: MessageDTO): Promise<void> {
    if (message.senderType !== 'human' || message.deletedAt) return;
    await this.deps.enqueueConsider(
      {
        conversationId: message.conversationId,
        trigger: 'message',
        sourceMessageId: message.id,
        requestId: `persona:${message.id}`,
      },
      20_500,
    );
  }

  async tick(): Promise<void> {
    const bucket = Math.floor(this.deps.now().getTime() / 120_000);
    for (const conversationId of await this.deps.store.enabledConversationIds()) {
      await this.deps.enqueueConsider(
        {
          conversationId,
          trigger: 'tick',
          requestId: `persona-tick:${conversationId}:${bucket}`,
        },
        0,
      );
    }
  }

  async consider(input: ConsiderInput): Promise<{ spoke: boolean; reason: string }> {
    const startedAt = this.deps.now().getTime();
    const context = await this.deps.store.loadContext(input.conversationId);
    if (!context) return { spoke: false, reason: 'no persona' };
    const source = input.sourceMessageId
      ? context.messages.find((message) => message.id === input.sourceMessageId)
      : undefined;
    const prefilter = prefilterMessage(context, source, {
      requested: input.requested || isReplyToPersona(context, source),
      now: this.deps.now(),
    });
    if (!prefilter.eligible) {
      const reason = 'prefilter found no useful opening';
      await this.deps.store.recordDecision(decisionRecord(input, { speak: false, reason }));
      return { spoke: false, reason };
    }

    const gate = evaluateHardGates(context, { direct: prefilter.direct, now: this.deps.now() });
    if (!gate.allowed) {
      await this.deps.store.recordDecision(decisionRecord(input, { speak: false, reason: gate.reason }));
      return { spoke: false, reason: gate.reason };
    }
    const budgetAllowed = await this.deps.consumeTextBudget(input.conversationId);
    if (!budgetAllowed) {
      const reason = 'hourly AI budget reached';
      await this.deps.store.recordDecision(decisionRecord(input, { speak: false, reason }));
      return { spoke: false, reason };
    }

    const prompt = buildPersonaPrompt(context, input.sourceMessageId, this.deps.now());
    const result = await this.deps.decide(prompt.messages);
    let decision = sanitizeSpeakDecision(result.data, {
      memoryIds: prompt.memories.map((memory) => memory.id),
      messageIds: context.messages.map((message) => message.id),
      userIds: context.members.map((member) => member.userId),
      candidateIds: [],
    });
    if (decision.intent === 'news' && !context.persona.allowNews) decision = { ...decision, speak: false };
    if (decision.intent === 'plan' && !context.persona.allowPlans) decision = { ...decision, speak: false };

    const extracted = normalizeExtractedMemories(decision, input.sourceMessageId);
    if (extracted.length) {
      const vectors = await this.deps.embed(extracted.map((memory) => memory.summary));
      await this.deps.store.saveMemories(
        input.conversationId,
        extracted.map((memory, index) => ({ ...memory, embedding: vectors[index]! })),
      );
    }
    await this.deps.store.upsertEvents(input.conversationId, decision.events);

    const imageRequested = Boolean(decision.imagePrompt) || decision.intent === 'image_surprise';
    const message = decision.message?.trim() ?? '';
    const guardedContent = [message, decision.imagePrompt].filter(Boolean).join('\n');
    const verdict = guardedContent
      ? await this.deps.guard(guardedContent)
      : ({ allow: true, category: 'ok', severity: 0 } satisfies GuardVerdict);
    const components = scoreComponents(context, decision.intent, prefilter.direct, this.deps.now());
    const unpenalizedScore = finalDecisionScore({
      model: decision.score,
      ...components,
      guard: verdict,
      surpriseImageOverBudget: false,
    });
    const threshold = decisionThreshold(context.persona.initiative, prefilter.direct);
    const styleAllowed = followsMessageStyle(message);
    const candidateCanSpeak =
      decision.speak && verdict.allow && styleAllowed && Boolean(message) && unpenalizedScore >= threshold;
    const weeklyBudgetAllowed =
      candidateCanSpeak && imageRequested
        ? await this.deps.consumeSurpriseBudget(input.conversationId, context.persona.surpriseImagesPerWeek)
        : true;
    const imagePermission = surpriseImagePermission({
      allowImages: context.persona.allowImages,
      requested: imageRequested,
      weeklyBudgetAllowed,
    });
    const finalScore = imagePermission.overBudget
      ? finalDecisionScore({
          model: decision.score,
          ...components,
          guard: verdict,
          surpriseImageOverBudget: true,
        })
      : unpenalizedScore;
    const imageOnlyBlocked = decision.intent === 'image_surprise' && !imagePermission.allowed;
    const speak = candidateCanSpeak && !imageOnlyBlocked && finalScore >= threshold;
    const reason = speak
      ? decision.reason
      : !verdict.allow
        ? `guard blocked ${verdict.category}`
        : !styleAllowed
          ? 'message violated length, hashtag, or emoji limits'
          : `score ${finalScore.toFixed(2)} below ${threshold.toFixed(2)} or model chose silence`;

    await this.deps.store.recordDecision(
      decisionRecord(input, {
        speak,
        intent: decision.intent,
        score: finalScore,
        reason,
        model: result.model,
        latencyMs: this.deps.now().getTime() - startedAt,
      }),
    );
    await this.deps
      .impact?.({
        kind: 'ai_interaction',
        groupId: input.conversationId,
        props: { outcome: speak ? 'spoke' : 'silent' },
      })
      .catch(() => undefined);
    if (!speak) return { spoke: false, reason };

    this.deps.emitTyping(input.conversationId, context.persona.id, true);
    try {
      await this.deps.sleep(typingDelayMs(message.length));
      let mediaIds: string[] | undefined;
      if (imagePermission.allowed && decision.imagePrompt) {
        const image = await this.deps.createImage({ prompt: decision.imagePrompt });
        const stored = await this.deps.storeImage(image.bytes, {
          kind: 'generated_image',
          mime: image.mime,
          aiGenerated: true,
          generator: image.model,
          captionAi: message,
        });
        mediaIds = [stored.id];
      }
      await this.deps.post(
        input.conversationId,
        mediaIds
          ? {
              kind: 'card',
              cardKind: 'ai_image',
              cardRefId: mediaIds[0],
              body: message,
              clientId: input.requestId ?? `persona:${input.sourceMessageId ?? startedAt}`,
              personaId: context.persona.id,
              meta: {
                reason: decision.reason,
                memoryIdsUsed: decision.memoryIdsUsed,
                degraded: result.degraded,
              },
            }
          : {
              kind: 'text',
              body: message,
              clientId: input.requestId ?? `persona:${input.sourceMessageId ?? startedAt}`,
              personaId: context.persona.id,
              meta: {
                reason: decision.reason,
                memoryIdsUsed: decision.memoryIdsUsed,
                degraded: result.degraded,
              },
            },
        { type: 'ai', personaId: context.persona.id, conversationId: input.conversationId },
      );
    } finally {
      this.deps.emitTyping(input.conversationId, context.persona.id, false);
    }
    return { spoke: true, reason };
  }
}

const service = new PersonaService();

export const getPersona = service.getPersona.bind(service);
export const updatePersona = service.updatePersona.bind(service);
export const mutePersona = service.mutePersona.bind(service);
export const removePersona = service.removePersona.bind(service);
export const listMemories = service.listMemories.bind(service);
export const updateMemory = service.updateMemory.bind(service);
export const deleteMemory = service.deleteMemory.bind(service);
export const explanation = service.explanation.bind(service);
export const testPersona = service.testPersona.bind(service);
export const avatarOptions = service.avatarOptions.bind(service);
export const selectAvatar = service.selectAvatar.bind(service);
export const onMessage = service.onMessage.bind(service);
export const tick = service.tick.bind(service);
export const consider = service.consider.bind(service);

export async function resolveAiImageCard(mediaId: string): Promise<AiImageCardDTO | undefined> {
  const row = await getRow(mediaId);
  if (!row) return undefined;
  const imageUrl = (await signedUrl(mediaId).catch(() => null)) ?? `/v1/media/${mediaId}`;
  return {
    mediaId,
    imageUrl,
    caption: row.captionAi,
    generator: row.generator ?? 'muse',
  };
}

/** Test helper for isolated policy/service suites; never used by production wiring. */
export function createPersonaServiceForTest(deps: Partial<PersonaDependencies>): PersonaService {
  const noNetworkBudget = new AiBudget(new InMemoryCounterStore());
  return new PersonaService({
    ...defaultDependencies,
    consumeTextBudget: async (conversationId) => (await noNetworkBudget.consumeText(conversationId)).allowed,
    consumeSurpriseBudget: async (conversationId) =>
      (await noNetworkBudget.consumeSurpriseImage(conversationId)).allowed,
    ...deps,
  });
}
