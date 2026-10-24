import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { z } from 'zod';

import { getAiConfig, type AiConfig } from './config.js';
import { GAMES_SYSTEM_PROMPT } from './prompts/games.js';
import { callStructured } from './structured.js';

export const FiveWordChoicesSchema = z.object({
  words: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
  loreTag: z.string().optional(),
});

export const GamePromptSchema = z.object({
  prompt: z.string().min(1),
  hint: z.string().min(1),
  source: z.enum(['lore', 'random']),
  loreMemoryId: z.string().optional(),
});

export const MemeEntrySpecSchema = z.object({
  caption: z.string().min(1),
  imagePrompt: z.string().optional(),
});

export type FiveWordChoices = z.infer<typeof FiveWordChoicesSchema>;
export type GamePrompt = z.infer<typeof GamePromptSchema>;
export type MemeEntrySpec = z.infer<typeof MemeEntrySpecSchema>;

export interface GameMemory {
  id: string;
  kind: 'joke' | 'preference' | 'event' | 'place' | 'nickname' | 'fact';
  summary: string;
  sensitivity: 'low' | 'medium' | 'high';
}

export interface GetGamePromptsInput {
  conversationId: string;
  mode: 'pictionary' | 'meme_battle' | 'one_word_story';
  contextSource: 'lore' | 'random' | 'hybrid';
  memories: GameMemory[];
  count?: number;
  config?: AiConfig;
}

const RANDOM_PROMPTS: GamePrompt[] = [
  { prompt: 'a pigeon running a tiny coffee shop', hint: 'bird, cafe, apron', source: 'random' },
  { prompt: 'the moon forgetting where it parked', hint: 'night, car, lost', source: 'random' },
  { prompt: 'a sandwich giving a dramatic speech', hint: 'food, podium, applause', source: 'random' },
  { prompt: 'a very serious squirrel detective', hint: 'animal, mystery, magnifier', source: 'random' },
];

function eligibleMemories(memories: GameMemory[]): GameMemory[] {
  return memories.filter(
    (memory) =>
      memory.sensitivity === 'low' &&
      (memory.kind === 'joke' || memory.kind === 'event' || memory.kind === 'place'),
  );
}

function randomPrompt(index: number): GamePrompt {
  return { ...RANDOM_PROMPTS[index % RANDOM_PROMPTS.length]! };
}

export async function getPrompts(input: GetGamePromptsInput): Promise<GamePrompt[]> {
  const count = Math.max(1, Math.min(input.count ?? 3, 12));
  const lore = eligibleMemories(input.memories);
  const useLore = input.contextSource !== 'random' && lore.length >= 3;
  if (!useLore) return Array.from({ length: count }, (_, index) => randomPrompt(index));

  const allowedIds = new Set(lore.map((memory) => memory.id));
  const memoryBlock = lore.map((memory) => `${memory.id}: ${memory.summary}`).join('\n');
  const prompts: GamePrompt[] = [];
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
    const prompt = result.data;
    if (prompt.source !== 'lore' || !prompt.loreMemoryId || !allowedIds.has(prompt.loreMemoryId)) {
      prompts.push(randomPrompt(index));
    } else {
      prompts.push(prompt);
    }
  }
  return prompts;
}

export interface FiveWordInput {
  story: string[];
  lore?: GameMemory[];
  config?: AiConfig;
}

const FALLBACK_WORDS = ['suddenly', 'together', 'noticed', 'another', 'doorway'] as const;

function validWordChoices(value: FiveWordChoices, previous?: string): boolean {
  const normalized = value.words.map((word) => word.trim().toLocaleLowerCase());
  return (
    new Set(normalized).size === 5 &&
    normalized.every((word) => /^\p{L}[\p{L}'-]*$/u.test(word)) &&
    (!previous || normalized.every((word) => word !== previous.toLocaleLowerCase()))
  );
}

export async function getFiveWordChoices(input: FiveWordInput): Promise<FiveWordChoices> {
  const previous = input.story.at(-1);
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: GAMES_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Continue this one-word story with exactly five distinct single-word choices. Do not repeat the last word.\nSTORY: ${input.story.join(' ')}\nLORE: ${(input.lore ?? []).map((memory) => memory.summary).join('; ')}`,
    },
  ];
  const result = await callStructured(FiveWordChoicesSchema, messages, {
    name: 'fiveWordChoices',
    reasoningEffort: 'minimal',
    timeoutMs: 4_000,
    config: input.config ?? getAiConfig(),
  });
  if (validWordChoices(result.data, previous)) return result.data;

  const words = FALLBACK_WORDS.filter((word) => word !== previous?.toLocaleLowerCase()).slice(0, 5);
  while (words.length < 5) words.push(`word${words.length + 1}` as (typeof FALLBACK_WORDS)[number]);
  return { words: words as [string, string, string, string, string] };
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

export const games = { getPrompts, getFiveWordChoices, getMemeEntry };
