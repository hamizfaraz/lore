import { describe, expect, it } from 'vitest';

import { games } from './games.js';

describe('game AI helpers', () => {
  it('returns exactly five distinct single-word choices in mock mode', async () => {
    const result = await games.fiveWordChoices({
      conversationId: 'conversation',
      storySoFar: ['Once'],
      contextSource: 'random',
      memories: [],
    });
    expect(result.words).toHaveLength(5);
    expect(new Set(result.words.map((word) => word.toLocaleLowerCase())).size).toBe(5);
    expect(result.words.every((word) => !word.includes(' '))).toBe(true);
  });

  it('uses random prompts when fewer than three eligible memories exist', async () => {
    const result = await games.getPrompts({
      conversationId: 'conversation',
      mode: 'pictionary',
      contextSource: 'lore',
      memories: [
        { id: 'one', kind: 'joke', summary: 'one memory', sensitivity: 'low' },
        { id: 'two', kind: 'event', summary: 'two memories', sensitivity: 'low' },
      ],
      count: 3,
    });

    expect(result.prompts).toHaveLength(3);
    expect(result.prompts.every((prompt) => prompt.source === 'random')).toBe(true);
    expect(result.usedLore).toBe(false);
    expect(result.degraded).toBe(false);
  });

  it('implements every frozen C1-facing game helper', async () => {
    expect(
      (await games.storyTitle({ words: ['we', 'made', 'a', 'tiny', 'moon', 'cafe'] })).title.split(' '),
    ).toHaveLength(6);
    expect(
      (await games.storyImage({ story: 'we made a tiny moon cafe', title: 'Moon Cafe' })).image.length,
    ).toBeGreaterThan(100);
    expect(
      (await games.memeEntry({ promptText: 'movie night', imageCaption: null })).caption.length,
    ).toBeGreaterThan(0);
    expect((await games.memeImage({ prompt: 'movie night' })).image.length).toBeGreaterThan(100);
  });
});
