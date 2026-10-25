import type { GameActionBody } from '@lore/shared/dto/games';
import { type GameRuntime, GameError } from './engine';

/** Pictionary [C1, P2] (section 8.5): private prompt for the drawer, strokes streamed (not persisted), normalized guesses. */

type Mutate = (
  id: string,
  fn: (g: GameRuntime) => Promise<GameRuntime> | GameRuntime,
) => Promise<GameRuntime>;
type Finalize = (id: string) => Promise<GameRuntime>;
type Sched = (g: GameRuntime) => void;

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[a.length][b.length];
}

/** lowercase, strip punctuation, Levenshtein ≤ 1, synonyms from the prompt's hint list. */
export function isCorrect(guess: string, prompt: string, hints: string[]): boolean {
  const g = normalize(guess);
  if (!g) return false;
  return [prompt, ...hints]
    .map(normalize)
    .filter(Boolean)
    .some((t) => t === g || levenshtein(t, g) <= 1);
}

export function startRound(g: GameRuntime, now: number, notice: string | null): GameRuntime {
  const round = g.round + 1;
  const order = g.pict?.drawerOrder ?? g.participants.map((p) => p.userId);
  const drawer = order[(round - 1) % order.length];
  const p = g.prompts[(round - 1) % Math.max(1, g.prompts.length)] ?? { prompt: 'cactus', hint: '' };
  return {
    ...g,
    state: 'active_round',
    round,
    pict: {
      drawerUserId: drawer,
      prompt: p.prompt,
      hints: p.hint ? p.hint.split(',').map((x) => x.trim()) : [],
      guesses: [],
      solvedBy: [],
      deadline: now + Math.max(45, g.config.timerSec * 3) * 1000,
      loreNotice: notice,
      drawerOrder: order,
    },
    lastActionAt: now,
    updatedAt: now,
  };
}

export function guess(g: GameRuntime, userId: string, text: string, now: number): GameRuntime {
  const p = g.pict;
  if (!p || g.state !== 'active_round') throw new GameError('CONFLICT', 'No active round');
  if (userId === p.drawerUserId) throw new GameError('FORBIDDEN', "The drawer can't guess");
  if (p.solvedBy.includes(userId)) return g;
  const correct = isCorrect(text, p.prompt, p.hints);
  const pict = {
    ...p,
    guesses: [...p.guesses, { userId, text: text.slice(0, 60), correct }],
    solvedBy: correct ? [...p.solvedBy, userId] : p.solvedBy,
  };
  const participants = correct
    ? g.participants.map((x) =>
        x.userId === userId
          ? { ...x, score: x.score + 100 }
          : x.userId === p.drawerUserId
            ? { ...x, score: x.score + 50 }
            : x,
      )
    : g.participants;
  const everyone = g.participants
    .filter((x) => x.userId !== p.drawerUserId)
    .every((x) => pict.solvedBy.includes(x.userId));
  return {
    ...g,
    pict,
    participants,
    state: everyone ? 'round_results' : g.state,
    lastActionAt: now,
    updatedAt: now,
  };
}

export async function act(
  id: string,
  userId: string,
  body: GameActionBody,
  mutate: Mutate,
  finalize: Finalize,
  sched: Sched,
): Promise<GameRuntime> {
  if (body.type === 'guess')
    return mutate(id, (g) => guess(g, userId, String(body.payload.text ?? ''), Date.now()));
  // skip / next turn (host)
  const g = await mutate(id, (g) => {
    if (g.hostUserId !== userId) throw new GameError('FORBIDDEN', 'Only the host can continue');
    const total = g.config.rounds * g.participants.length;
    if (g.round >= total) return { ...g, state: 'completed' as const, updatedAt: Date.now() };
    return startRound(g, Date.now(), g.pict?.loreNotice ?? null);
  });
  if (g.state === 'completed') return finalize(id);
  sched(g);
  return g;
}

export async function onTimer(
  id: string,
  key: string,
  mutate: Mutate,
  _f: Finalize,
  _s: Sched,
): Promise<GameRuntime> {
  return mutate(id, (g) =>
    `r${g.round}` === key && g.state === 'active_round'
      ? { ...g, state: 'round_results', updatedAt: Date.now() }
      : g,
  );
}

export function result(g: GameRuntime): NonNullable<GameRuntime['result']> {
  const top = Math.max(...g.participants.map((p) => p.score));
  return {
    title: 'Pictionary',
    text: null,
    imageUrl: null,
    imageMediaId: null,
    winners: g.participants.filter((p) => p.score === top && top > 0).map((p) => p.userId),
  };
}
