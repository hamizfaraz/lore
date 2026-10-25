import { zGameConfig } from '@lore/shared/dto/games';
import { describe, expect, it } from 'vitest';
import * as E from './engine';
import * as meme from './meme';
import * as pict from './pictionary';
import { shouldUseLore } from './prompts';
import { localFiveWords } from './words';

const P = (id: string) => ({ userId: id, displayName: id.toUpperCase(), avatarUrl: null });
const now = 1_000_000;

function game(mode: 'one_word_story' | 'meme_battle' | 'pictionary', players = ['a', 'b', 'c'], cfg = {}) {
  let g = E.newRuntime({
    id: 'g1',
    conversationId: 'c1',
    mode,
    config: zGameConfig.parse({ maxWords: 6, ...cfg }),
    host: P(players[0]),
    now,
  });
  for (const p of players.slice(1)) g = E.join(g, P(p), now);
  return g;
}
const five = ['one', 'two', 'three', 'four', 'five'];

describe('one-word story', () => {
  it('shows exactly five choices per turn, only to the active player', () => {
    expect(() => E.startOws(game('one_word_story'), ['a', 'b', 'c', 'd'], now, null)).toThrow();
    const g = E.startOws(game('one_word_story'), five, now, null);
    expect(E.viewFor(g, 'a').round).toMatchObject({ choices: five });
    expect((E.viewFor(g, 'b').round as { choices: unknown }).choices).toBeNull();
    for (let i = 0; i < 50; i++) {
      const w = localFiveWords(['the', 'cactus']);
      expect(E.validFiveWords(w, ['the', 'cactus'])).toBe(true);
    }
  });

  it('chosen word is immutable and turns rotate in join order', () => {
    let g = E.startOws(game('one_word_story'), five, now, null);
    g = E.chooseWord(g, 'a', 'two', ['six', 'seven', 'eight', 'nine', 'ten'], now + 1);
    expect(g.ows!.words).toEqual([{ word: 'two', userId: 'a' }]);
    expect(() => E.chooseWord(g, 'a', 'six', five, now + 2)).toThrow(/not your turn/);
    expect(E.owsActiveUser(g)).toBe('b');
    expect(g.ows!.words[0].word).toBe('two');
  });

  it('completes at the configured word count', () => {
    let g = E.startOws(game('one_word_story', ['a', 'b']), five, now, null);
    const sets = [
      ['alpha', 'beta', 'gamma', 'delta', 'eps'],
      ['k1', 'k2', 'k3', 'k4', 'k5'],
    ];
    for (let i = 0; i < 6; i++) {
      const who = E.owsActiveUser(g)!;
      g = E.chooseWord(g, who, g.ows!.choices[0], sets[i % 2], now + i);
    }
    expect(g.state).toBe('completed');
    expect(g.ows!.words).toHaveLength(6);
  });

  it('random fallback with fewer than 3 memories', () => {
    expect(shouldUseLore('lore', 2)).toBe(false);
    expect(shouldUseLore('hybrid', 3)).toBe(true);
    expect(shouldUseLore('random', 10)).toBe(false);
  });
});

describe('meme battle', () => {
  function withEntries() {
    let g = meme.startRound(game('meme_battle', ['a', 'b', 'c']), now, null);
    for (const u of ['a', 'b', 'c'])
      g = meme.submitEntry(g, u, { caption: `by ${u}`, imageUrl: null, imageMediaId: null }, now);
    g = meme.addAiEntry(g, { caption: 'by ai', imageUrl: null, imageMediaId: null });
    return meme.beginVoting(g, now, () => 0.5);
  }

  it('votes and authorship stay anonymous in caller-filtered state until reveal', () => {
    let g = withEntries();
    g = meme.castVote(g, 'a', g.meme!.entries.find((e) => e.userId === 'b')!.slot, now);
    const v = E.viewFor(g, 'c').round as Extract<
      NonNullable<ReturnType<typeof E.viewFor>['round']>,
      { mode: 'meme_battle' }
    >;
    expect(v.gallery.every((e) => e.creator === null && e.votes === null)).toBe(true);
    expect(JSON.stringify(E.viewFor(g, 'c'))).not.toContain('"userId":"b","displayName":"B","type"');
    expect(JSON.stringify(v.gallery)).not.toMatch(/"(b|a)"/);
    g = meme.castVote(g, 'b', g.meme!.entries.find((e) => e.creatorType === 'ai')!.slot, now);
    g = meme.castVote(g, 'c', g.meme!.entries.find((e) => e.userId === 'b')!.slot, now);
    g = meme.reveal(g, now);
    const r = E.viewFor(g, 'c').round as typeof v;
    expect(r.gallery.find((e) => e.creator?.type === 'ai')).toBeTruthy();
    expect(g.participants.find((p) => p.userId === 'b')!.score).toBe(200);
  });

  it('self-vote is blocked when configured', () => {
    const g = withEntries();
    const own = g.meme!.entries.find((e) => e.userId === 'a')!.slot;
    expect(() => meme.castVote(g, 'a', own, now)).toThrow(/own meme/);
  });

  it('one vote per player', () => {
    let g = withEntries();
    const s = g.meme!.entries.find((e) => e.userId === 'b')!.slot;
    g = meme.castVote(g, 'a', s, now);
    expect(() => meme.castVote(g, 'a', s, now)).toThrow(/already voted/);
  });
});

describe('lifecycle', () => {
  it('abandoning a game publishes nothing', () => {
    const lobby = game('one_word_story');
    const ended = E.endByHost(lobby, 'a', now);
    expect(ended.state).toBe('abandoned');
    expect(E.canShareResult(ended)).toBe(false);
    const idle = E.maybeAbandon(E.startOws(game('one_word_story'), five, now, null), now + E.ABANDON_MS + 1);
    expect(idle.state).toBe('abandoned');
    expect(
      E.canShareResult({
        ...idle,
        result: { title: 'x', text: 'x', imageUrl: null, imageMediaId: 'm', winners: [] },
      }),
    ).toBe(false);
  });
});

describe('pictionary', () => {
  it("a spectator's game.state never contains the prompt", () => {
    const g = pict.startRound(
      {
        ...game('pictionary', ['a', 'b', 'c']),
        prompts: [{ prompt: 'waffle tower', hint: 'waffles', source: 'random' }],
      },
      now,
      null,
    );
    const drawer = g.pict!.drawerUserId;
    expect((E.viewFor(g, drawer).round as { prompt: string | null }).prompt).toBe('waffle tower');
    for (const viewer of ['b', 'c', 'zed', null]) {
      if (viewer === drawer) continue;
      expect(JSON.stringify(E.viewFor(g, viewer))).not.toContain('waffle tower');
    }
  });

  it('matches guesses after normalization and Levenshtein ≤ 1', () => {
    expect(pict.isCorrect('Waffle-Tower!', 'waffle tower', [])).toBe(true);
    expect(pict.isCorrect('wafle tower', 'waffle tower', [])).toBe(true);
    expect(pict.isCorrect('waffles', 'waffle tower', ['waffles'])).toBe(true);
    expect(pict.isCorrect('pancake', 'waffle tower', [])).toBe(false);
  });
});
