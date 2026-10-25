import {
  FiveWordChoices as FiveWordChoicesSchema,
  GamePrompt as GamePromptSchema,
  MemeEntrySpec as MemeEntrySpecSchema,
  type FiveWordChoices,
  type GamePrompt,
  type MemeEntrySpec,
} from '@lore/shared/ai';
import type { ContextSource, GameMode } from '@lore/shared/enums';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import { generateMuseImage } from './clients/museImage.js';
import { getAiConfig, type AiConfig } from './config.js';
import { GAMES_SYSTEM_PROMPT } from './prompts/games.js';
import { withHouseImageStyle } from './prompts/imageStyle.js';
import { callStructured } from './structured.js';

export type LoreMemoryForGames = {
  id: string;
  kind: string;
  summary: string;
  sensitivity: string;
};

export interface GetGamePromptsInput {
  conversationId: string;
  mode: GameMode;
  contextSource: ContextSource;
  count: number;
  memories: LoreMemoryForGames[];
  config?: AiConfig;
}

export interface FiveWordInput {
  conversationId: string;
  storySoFar: string[];
  contextSource: ContextSource;
  memories: LoreMemoryForGames[];
  config?: AiConfig;
}

const RANDOM_PROMPTS: GamePrompt[] = [
  { prompt: 'a pigeon running a tiny coffee shop', hint: 'bird, cafe, apron', source: 'random' },
  { prompt: 'the moon forgetting where it parked', hint: 'night, car, lost', source: 'random' },
  { prompt: 'a sandwich giving a dramatic speech', hint: 'food, podium, applause', source: 'random' },
  { prompt: 'a very serious squirrel detective', hint: 'animal, mystery, magnifier', source: 'random' },
];

const FALLBACK_WORDS = ['suddenly', 'together', 'noticed', 'another', 'doorway'] as const;

function eligibleMemories(memories: LoreMemoryForGames[]): LoreMemoryForGames[] {
  return memories.filter(
    (memory) =>
      memory.sensitivity === 'low' &&
      (memory.kind === 'joke' || memory.kind === 'event' || memory.kind === 'place'),
  );
}

function randomPrompt(index: number): GamePrompt {
  return { ...RANDOM_PROMPTS[index % RANDOM_PROMPTS.length]! };
}

function validWordChoices(value: FiveWordChoices, previous?: string): boolean {
  const normalized = value.words.map((word) => word.trim().toLocaleLowerCase());
  return (
    new Set(normalized).size === 5 &&
    normalized.every((word) => /^\p{L}[\p{L}'-]*$/u.test(word)) &&
    (!previous || normalized.every((word) => word !== previous.toLocaleLowerCase()))
  );
}

function sixWordTitle(words: string[]): string {
  const clean = words.map((word) => word.replace(/[^\p{L}\p{N}'-]/gu, '').trim()).filter(Boolean);
  const fallback = ['our', 'strange', 'little', 'story', 'made', 'together'];
  const titleWords = [...clean.slice(0, 6), ...fallback].slice(0, 6);
  const title = titleWords.join(' ');
  return title.charAt(0).toLocaleUpperCase() + title.slice(1);
}

export async function getPrompts(input: GetGamePromptsInput): Promise<{
  prompts: GamePrompt[];
  usedLore: boolean;
  degraded: boolean;
}> {
  const count = Math.max(1, Math.min(input.count, 12));
  const lore = eligibleMemories(input.memories);
  const useLore = input.contextSource !== 'random' && lore.length >= 3;
  if (!useLore) {
    return {
      prompts: Array.from({ length: count }, (_, index) => randomPrompt(index)),
      usedLore: false,
      degraded: false,
    };
  }

  const allowedIds = new Set(lore.map((memory) => memory.id));
  const memoryBlock = lore.map((memory) => `${memory.id}: ${memory.summary}`).join('\n');
  const prompts: GamePrompt[] = [];
  let degraded = false;

  for (let index = 0; index < count; index += 1) {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: GAMES_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Create one ${input.mode} prompt for conversation ${input.conversationId}. Use one of these memories:\n${memoryBlock}`,
      },
    ];
    const result = await callStructured(GamePromptSchema, messages, {
      name: 'gamePrompt',
      reasoningEffort: 'minimal',
      timeoutMs: 6_000,
      config: input.config ?? getAiConfig(),
      mockValue: {
        prompt: `${lore[index % lore.length]!.summary} takes an unexpected turn`,
        hint: 'group lore, surprise, friends',
        source: 'lore',
        loreMemoryId: lore[index % lore.length]!.id,
      },
    });
    degraded ||= result.degraded;
    const prompt = result.data;
    if (prompt.source !== 'lore' || !prompt.loreMemoryId || !allowedIds.has(prompt.loreMemoryId)) {
      prompts.push(randomPrompt(index));
    } else {
      prompts.push(prompt);
    }
  }

  return {
    prompts,
    usedLore: prompts.some((prompt) => prompt.source === 'lore'),
    degraded,
  };
}

export async function fiveWordChoices(
  input: FiveWordInput,
): Promise<FiveWordChoices & { degraded: boolean }> {
  const previous = input.storySoFar.at(-1);
  const lore = eligibleMemories(input.memories);
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: GAMES_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Continue this one-word story with exactly five distinct single-word choices. Do not repeat the last word.\nSTORY: ${input.storySoFar.join(' ')}\nLORE: ${lore.map((memory) => memory.summary).join('; ')}`,
    },
  ];
  const result = await callStructured(FiveWordChoicesSchema, messages, {
    name: 'fiveWordChoices',
    reasoningEffort: 'minimal',
    timeoutMs: 4_000,
    config: input.config ?? getAiConfig(),
  });
  if (validWordChoices(result.data, previous)) {
    return { ...result.data, degraded: result.degraded };
  }

  const words = FALLBACK_WORDS.filter((word) => word !== previous?.toLocaleLowerCase()).slice(0, 5);
  while (words.length < 5) words.push(`word${words.length + 1}` as (typeof FALLBACK_WORDS)[number]);
  return {
    words: words as [string, string, string, string, string],
    degraded: true,
  };
}

export async function getFiveWordChoices(input: {
  story: string[];
  lore?: LoreMemoryForGames[];
  config?: AiConfig;
}): Promise<FiveWordChoices> {
  const result = await fiveWordChoices({
    conversationId: 'direct-helper',
    storySoFar: input.story,
    contextSource: input.lore?.length ? 'hybrid' : 'random',
    memories: input.lore ?? [],
    ...(input.config ? { config: input.config } : {}),
  });
  return FiveWordChoicesSchema.parse(result);
}

export async function storyTitle(input: {
  words: string[];
}): Promise<{ title: string; degraded: boolean }> {
  return { title: sixWordTitle(input.words), degraded: false };
}

export async function storyImage(input: {
  story: string;
  title: string;
}): Promise<{ image: Buffer; mime: string; degraded: boolean }> {
  const result = await generateMuseImage({
    prompt: withHouseImageStyle(`One-word story ending art for "${input.title}": ${input.story}`),
  });
  return { image: result.bytes, mime: result.mime, degraded: result.degraded };
}

export async function memeEntry(input: {
  promptText: string | null;
  imageCaption?: string | null;
}): Promise<MemeEntrySpec & { degraded: boolean }> {
  const prompt =
    [input.promptText, input.imageCaption].filter(Boolean).join(' — ') || 'friends being chaotic';
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: GAMES_SYSTEM_PROMPT },
    { role: 'user', content: `Write one concise meme entry for this prompt: ${prompt}` },
  ];
  const result = await callStructured(MemeEntrySpecSchema, messages, {
    name: 'memeEntrySpec',
    reasoningEffort: 'minimal',
    timeoutMs: 6_000,
    config: getAiConfig(),
  });
  return { ...result.data, degraded: result.degraded };
}

export async function getMemeEntry(prompt: string, config: AiConfig = getAiConfig()): Promise<MemeEntrySpec> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: GAMES_SYSTEM_PROMPT },
    { role: 'user', content: `Write one concise meme entry for this prompt: ${prompt}` },
  ];
  const result = await callStructured(MemeEntrySpecSchema, messages, {
    name: 'memeEntrySpec',
    reasoningEffort: 'minimal',
    timeoutMs: 6_000,
    config,
  });
  return result.data;
}

export async function memeImage(input: {
  prompt: string;
}): Promise<{ image: Buffer; mime: string; degraded: boolean }> {
  const result = await generateMuseImage({
    prompt: withHouseImageStyle(`Playful meme battle prompt image: ${input.prompt}`),
  });
  return { image: result.bytes, mime: result.mime, degraded: result.degraded };
}

export const games = {
  getPrompts,
  fiveWordChoices,
  storyTitle,
  storyImage,
  memeEntry,
  memeImage,
};
