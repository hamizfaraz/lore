import { describe, expect, it } from 'vitest';

import { AiBudget, InMemoryCounterStore } from './budget.js';

describe('AiBudget', () => {
  it('enforces per-conversation text and global image limits', async () => {
    const budget = new AiBudget(new InMemoryCounterStore(), {
      textCallsPerConversationPerHour: 2,
      imagesPerHourGlobal: 1,
      surpriseImagesPerConversationPerWeek: 1,
    });

    expect((await budget.consumeText('a')).allowed).toBe(true);
    expect((await budget.consumeText('a')).allowed).toBe(true);
    expect((await budget.consumeText('a')).allowed).toBe(false);
    expect((await budget.consumeText('b')).allowed).toBe(true);
    expect((await budget.consumeImage()).allowed).toBe(true);
    expect((await budget.consumeImage()).allowed).toBe(false);
  });
});
