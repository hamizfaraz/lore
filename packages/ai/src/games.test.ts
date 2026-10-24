import { describe, expect, it } from 'vitest';

import { getFiveWordChoices, getPrompts } from './games.js';

describe('game AI helpers', () => {
  it('returns exactly five distinct single-word choices in mock mode', async () => {
    const result = await getFiveWordChoices({ story: ['Once'] });
    expect(result.words).toHaveLength(5);
    expect(new Set(result.words.map((word) => word.toLocaleLowerCase())).size).toBe(5);
    expect(result.words.every((word) => !word.includes(' '))).toBe(true);
  });

  it('uses random prompts when fewer than three eligible memories exist', async () => {
    const prompts = await getPrompts({
      conversationId: 'conversation',
      mode: 'pictionary',
      contextSource: 'lore',
      memories: [
        { id: 'one', kind: 'joke', summary: 'one memory', sensitivity: 'low' },
        { id: 'two', kind: 'event', summary: 'two memories', sensitivity: 'low' },
      ],
      count: 3,
    });

    expect(prompts).toHaveLength(3);
    expect(prompts.every((prompt) => prompt.source === 'random')).toBe(true);
  });
});
