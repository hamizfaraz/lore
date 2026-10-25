import * as ai from '@lore/ai';
import { and, eq, inArray, isNull, aiMemories } from '@lore/db';
import type { GamePrompt } from '@lore/shared/ai';
import type { ContextSource, GameMode } from '@lore/shared/enums';
import { getDb } from '../../lib/db';
import { logger } from '../../lib/logger';
import { RANDOM_PROMPTS, localFiveWords, pick } from './words';

/**
 * Prompt sourcing with the spec's fallback rule (section 8.5): permitted memories (low sensitivity,
 * kind joke/event/place) when there are at least 3; otherwise random prompts and the lobby shows
 * "Not enough group lore yet, using random prompts". Calls C2's @lore/ai; falls back locally if it
 * is not implemented yet or degraded.
 */
export const LORE_NOTICE = 'Not enough group lore yet, using random prompts';

export async function permittedMemories(conversationId: string) {
  return getDb()
    .select({
      id: aiMemories.id,
      kind: aiMemories.kind,
      summary: aiMemories.summary,
      sensitivity: aiMemories.sensitivity,
    })
    .from(aiMemories)
    .where(
      and(
        eq(aiMemories.conversationId, conversationId),
        eq(aiMemories.sensitivity, 'low'),
        inArray(aiMemories.kind, ['joke', 'event', 'place']),
        isNull(aiMemories.deletedAt),
      ),
    )
    .limit(30);
}

export function shouldUseLore(contextSource: ContextSource, memoryCount: number) {
  return contextSource !== 'random' && memoryCount >= 3;
}

export async function getPrompts(
  conversationId: string,
  mode: GameMode,
  contextSource: ContextSource,
  count: number,
): Promise<{ prompts: GamePrompt[]; usedLore: boolean; notice: string | null }> {
  const memories = await permittedMemories(conversationId).catch(() => []);
  const lore = shouldUseLore(contextSource, memories.length);
  try {
    const r = await ai.games.getPrompts({
      conversationId,
      mode,
      contextSource: lore ? contextSource : 'random',
      count,
      memories,
    });
    const usedLore = r.usedLore && lore;
    return {
      prompts: r.prompts.slice(0, count),
      usedLore,
      notice: usedLore ? null : contextSource === 'random' ? null : LORE_NOTICE,
    };
  } catch (err) {
    if (!(err instanceof ai.AiNotImplemented))
      logger.warn({ err: (err as Error).message }, 'ai.games.getPrompts failed; using random prompts');
    const bank = RANDOM_PROMPTS[mode];
    const prompts: GamePrompt[] = Array.from({ length: count }, () => ({
      prompt: pick(bank),
      hint: '',
      source: 'random' as const,
    }));
    return { prompts, usedLore: false, notice: contextSource === 'random' ? null : LORE_NOTICE };
  }
}

export async function fiveWords(
  conversationId: string,
  story: string[],
  contextSource: ContextSource,
): Promise<string[]> {
  try {
    const memories = shouldUseLore(contextSource, 3)
      ? await permittedMemories(conversationId).catch(() => [])
      : [];
    const r = await ai.games.fiveWordChoices({ conversationId, storySoFar: story, contextSource, memories });
    const words = [...r.words].map((w) => w.trim().split(/\s+/)[0]);
    const last = story[story.length - 1]?.toLowerCase();
    const distinct = new Set(words.map((w) => w.toLowerCase()));
    if (words.length === 5 && distinct.size === 5 && !distinct.has(last ?? '\u0000')) return words;
    logger.warn('fiveWordChoices invalid; local fallback');
  } catch (err) {
    if (!(err instanceof ai.AiNotImplemented))
      logger.warn({ err: (err as Error).message }, 'fiveWordChoices failed');
  }
  return localFiveWords(story);
}

export async function storyTitle(words: string[]): Promise<string> {
  try {
    return (await ai.games.storyTitle({ words })).title;
  } catch {
    const t = words
      .slice(0, 6)
      .join(' ')
      .replace(/[.,!?;:]+$/, '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
}

export async function storyImage(
  story: string,
  title: string,
): Promise<{ image: Buffer; mime: string; ai: boolean } | null> {
  try {
    const r = await ai.games.storyImage({ story, title });
    return { image: r.image, mime: r.mime, ai: true };
  } catch (err) {
    if (!(err instanceof ai.AiNotImplemented))
      logger.warn({ err: (err as Error).message }, 'storyImage failed');
    return null;
  }
}
