/**
 * @lore/ai — OWNED BY COMPUTER 2 (plan section 7). This file was created by the C1-0b scaffold with
 * typed stubs only, so Computer 1 can code against the signatures. Computer 2 replaces the bodies
 * (and adds clients/, structured.ts, prompts/, mocks/, budget.ts, guard.ts) without changing the
 * exported signatures below. Other packages import ONLY from this index.
 */
import type { ContextSource, GameMode } from '@lore/shared/enums';
import type { FiveWordChoices, GamePrompt, GuardVerdict, MemeEntrySpec } from '@lore/shared/ai';

export class AiNotImplemented extends Error {
  constructor(fn: string) {
    super(`@lore/ai ${fn} is not implemented yet (Computer 2)`);
    this.name = 'AiNotImplemented';
  }
}

export type LoreMemoryForGames = { id: string; kind: string; summary: string; sensitivity: string };

/** Game helpers Computer 1's game engine calls (section 6 cross-boundary table: `ai.games.*`). */
export const games = {
  /**
   * Prefetched at lobby creation. Uses permitted memories (low sensitivity, kind joke/event/place)
   * when there are >= 3; otherwise returns random prompts and `usedLore = false`.
   */
  async getPrompts(_input: {
    conversationId: string;
    mode: GameMode;
    contextSource: ContextSource;
    count: number;
    memories: LoreMemoryForGames[];
  }): Promise<{ prompts: GamePrompt[]; usedLore: boolean; degraded: boolean }> {
    throw new AiNotImplemented('games.getPrompts');
  },

  /** Five distinct single words, none equal to the story's last word. */
  async fiveWordChoices(_input: {
    conversationId: string;
    storySoFar: string[];
    contextSource: ContextSource;
    memories: LoreMemoryForGames[];
  }): Promise<FiveWordChoices & { degraded: boolean }> {
    throw new AiNotImplemented('games.fiveWordChoices');
  },

  /** Six-word title for a finished one-word story. */
  async storyTitle(_input: { words: string[] }): Promise<{ title: string; degraded: boolean }> {
    throw new AiNotImplemented('games.storyTitle');
  },

  /** House-style illustration of the finished story (Muse Image). Returns PNG/JPEG bytes. */
  async storyImage(_input: { story: string; title: string }): Promise<{ image: Buffer; mime: string; degraded: boolean }> {
    throw new AiNotImplemented('games.storyImage');
  },

  /** AI competitor entry for Meme Battle. */
  async memeEntry(_input: { promptText: string | null; imageCaption?: string | null }): Promise<MemeEntrySpec & { degraded: boolean }> {
    throw new AiNotImplemented('games.memeEntry');
  },

  /** Meme prompt image (Muse Image). */
  async memeImage(_input: { prompt: string }): Promise<{ image: Buffer; mime: string; degraded: boolean }> {
    throw new AiNotImplemented('games.memeImage');
  },
};

/** Safety guard (Gemini Flash) for lore-based prompts and meme captions (section 7 guardrails). */
export async function guard(_text: string): Promise<GuardVerdict> {
  throw new AiNotImplemented('guard');
}
