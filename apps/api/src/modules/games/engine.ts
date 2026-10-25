/**
 * Server-authoritative game state machine [C1] (section 8.5). PURE: no I/O here, so it is unit-tested
 * directly. Phases: lobby → active_round → round_results → completed, plus abandoned after 10 min idle.
 * The service layer loads/saves the runtime (Valkey + Postgres mirror) and performs effects.
 */
import type { GameConfig, GameStateDTO } from '@lore/shared/dto/games';
import type { GameMode, GameState } from '@lore/shared/enums';
import { playerColors } from '@lore/tokens';

export const ABANDON_MS = 10 * 60_000;

export type Participant = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  team: string | null;
  score: number;
  ready: boolean;
  joinedAt: number;
};

export type OwsState = {
  words: { word: string; userId: string }[];
  turnIndex: number;
  /** current five choices (only revealed to the active player) */
  choices: string[];
  /** prefetched choices for the next player (section 8.5: prefetched while the current one chooses) */
  nextChoices: string[] | null;
  deadline: number | null;
  loreNotice: string | null;
};

export type MemeEntry = {
  id: string;
  slot: number;
  creatorType: 'human' | 'ai';
  userId: string | null;
  caption: string;
  imageUrl: string | null;
  imageMediaId: string | null;
};
export type MemeState = {
  phase: 'submitting' | 'voting' | 'reveal';
  prompt: {
    kind: 'image' | 'caption';
    text: string | null;
    imageUrl: string | null;
    imageMediaId: string | null;
    imageOptions: { url: string; mediaId: string | null }[] | null;
  };
  entries: MemeEntry[];
  votes: Record<string, string>; // voterUserId → entryId
  deadline: number | null;
  loreNotice: string | null;
};

export type PictState = {
  drawerUserId: string;
  prompt: string;
  hints: string[];
  guesses: { userId: string; text: string; correct: boolean }[];
  solvedBy: string[];
  deadline: number | null;
  loreNotice: string | null;
  drawerOrder: string[];
};

export type GameRuntime = {
  id: string;
  conversationId: string;
  mode: GameMode;
  state: GameState;
  config: GameConfig;
  hostUserId: string;
  round: number;
  participants: Participant[];
  ows: OwsState | null;
  meme: MemeState | null;
  pict: PictState | null;
  prompts: { prompt: string; hint: string; source: 'lore' | 'random'; loreMemoryId?: string }[];
  usedLore: boolean;
  result: {
    title: string | null;
    text: string | null;
    imageUrl: string | null;
    imageMediaId: string | null;
    winners: string[];
    imageAiGenerated?: boolean;
  } | null;
  lastActionAt: number;
  updatedAt: number;
};

export class GameError extends Error {
  constructor(
    public code: 'BAD_REQUEST' | 'FORBIDDEN' | 'CONFLICT',
    message: string,
  ) {
    super(message);
  }
}

export function newRuntime(input: {
  id: string;
  conversationId: string;
  mode: GameMode;
  config: GameConfig;
  host: Omit<Participant, 'score' | 'ready' | 'joinedAt' | 'team'>;
  now: number;
}): GameRuntime {
  return {
    id: input.id,
    conversationId: input.conversationId,
    mode: input.mode,
    state: 'lobby',
    config: input.config,
    hostUserId: input.host.userId,
    round: 0,
    participants: [{ ...input.host, team: null, score: 0, ready: true, joinedAt: input.now }],
    ows: null,
    meme: null,
    pict: null,
    prompts: [],
    usedLore: false,
    result: null,
    lastActionAt: input.now,
    updatedAt: input.now,
  };
}

export function join(
  g: GameRuntime,
  p: Omit<Participant, 'score' | 'ready' | 'joinedAt' | 'team'>,
  now: number,
): GameRuntime {
  if (g.state !== 'lobby' && g.mode !== 'one_word_story')
    throw new GameError('CONFLICT', 'This game already started');
  if (g.state === 'completed' || g.state === 'abandoned')
    throw new GameError('CONFLICT', 'This game is over');
  if (g.participants.some((x) => x.userId === p.userId)) return g;
  const team = g.config.teams ? (g.participants.length % 2 === 0 ? 'A' : 'B') : null;
  return {
    ...g,
    participants: [...g.participants, { ...p, team, score: 0, ready: true, joinedAt: now }],
    lastActionAt: now,
    updatedAt: now,
  };
}

// ── One-Word Story ──────────────────────────────────────────────────────────────────────────
export function owsActiveUser(g: GameRuntime): string | null {
  if (!g.ows || !g.participants.length) return null;
  return g.participants[g.ows.turnIndex % g.participants.length].userId;
}

export function validFiveWords(words: string[], story: string[]): boolean {
  if (words.length !== 5) return false;
  const lower = words.map((w) => w.trim().toLowerCase());
  if (lower.some((w) => !w || /\s/.test(w))) return false;
  if (new Set(lower).size !== 5) return false;
  const last = story[story.length - 1]?.toLowerCase();
  return !lower.includes(last ?? '\u0000');
}

export function startOws(
  g: GameRuntime,
  choices: string[],
  now: number,
  loreNotice: string | null,
): GameRuntime {
  if (g.state !== 'lobby') throw new GameError('CONFLICT', 'Already started');
  if (!validFiveWords(choices, []))
    throw new GameError('BAD_REQUEST', 'Exactly five distinct words are required');
  return {
    ...g,
    state: 'active_round',
    round: 1,
    ows: {
      words: [],
      turnIndex: 0,
      choices,
      nextChoices: null,
      deadline: now + g.config.timerSec * 1000,
      loreNotice,
    },
    lastActionAt: now,
    updatedAt: now,
  };
}

/** Active player taps one of exactly five cards. The chosen word is immutable once chosen. */
export function chooseWord(
  g: GameRuntime,
  userId: string,
  word: string,
  nextChoices: string[],
  now: number,
): GameRuntime {
  if (g.mode !== 'one_word_story' || g.state !== 'active_round' || !g.ows)
    throw new GameError('CONFLICT', 'No active turn');
  if (owsActiveUser(g) !== userId) throw new GameError('FORBIDDEN', "It's not your turn");
  if (!g.ows.choices.includes(word)) throw new GameError('BAD_REQUEST', 'Pick one of your five words');
  const words = [...g.ows.words, { word, userId }];
  const done = words.length >= g.config.maxWords;
  if (
    !done &&
    !validFiveWords(
      nextChoices,
      words.map((w) => w.word),
    )
  )
    throw new GameError('BAD_REQUEST', 'Next choices invalid');
  return {
    ...g,
    state: done ? 'completed' : 'active_round',
    ows: {
      ...g.ows,
      words,
      turnIndex: g.ows.turnIndex + 1,
      choices: done ? [] : nextChoices,
      nextChoices: null,
      deadline: done ? null : now + g.config.timerSec * 1000,
    },
    participants: g.participants.map((p) => (p.userId === userId ? { ...p, score: p.score + 1 } : p)),
    lastActionAt: now,
    updatedAt: now,
  };
}

/** 20 s timer: picks nothing and skips to the next player (section 8.5). */
export function skipTurn(g: GameRuntime, nextChoices: string[], now: number): GameRuntime {
  if (g.state !== 'active_round' || !g.ows) return g;
  return {
    ...g,
    ows: {
      ...g.ows,
      turnIndex: g.ows.turnIndex + 1,
      choices: nextChoices,
      nextChoices: null,
      deadline: now + g.config.timerSec * 1000,
    },
    updatedAt: now,
  };
}

// ── shared lifecycle ──────────────────────────────────────────────────────────────────────────
export function endByHost(g: GameRuntime, userId: string, now: number): GameRuntime {
  if (g.hostUserId !== userId) throw new GameError('FORBIDDEN', 'Only the host can end the game');
  if (g.state === 'completed' || g.state === 'abandoned') return g;
  // ending an unstarted lobby abandons it; a started story completes with what it has
  const hasContent = (g.ows?.words.length ?? 0) > 0 || (g.meme?.entries.length ?? 0) > 0 || g.round > 1;
  return { ...g, state: hasContent ? 'completed' : 'abandoned', lastActionAt: now, updatedAt: now };
}

export function maybeAbandon(g: GameRuntime, now: number): GameRuntime {
  if (g.state === 'completed' || g.state === 'abandoned') return g;
  return now - g.lastActionAt > ABANDON_MS ? { ...g, state: 'abandoned', updatedAt: now } : g;
}

/** Abandoning a game publishes nothing: only completed games may produce shareable results. */
export function canShareResult(g: GameRuntime): boolean {
  return g.state === 'completed' && Boolean(g.result);
}

// ── caller-filtered view (private prompts and anonymous authorship never reach the wrong client) ──
export function viewFor(
  g: GameRuntime,
  viewerId: string | null,
  resultImageUrl?: string | null,
): GameStateDTO {
  const colorOf = new Map(g.participants.map((p, i) => [p.userId, playerColors[i % playerColors.length]]));
  let round: GameStateDTO['round'] = null;
  if (g.mode === 'one_word_story' && g.ows) {
    const active = owsActiveUser(g);
    round = {
      mode: 'one_word_story',
      words: g.ows.words,
      activeUserId: g.state === 'active_round' ? active : null,
      choices: g.state === 'active_round' && viewerId && viewerId === active ? g.ows.choices : null,
      deadline: g.ows.deadline ? new Date(g.ows.deadline).toISOString() : null,
      maxWords: g.config.maxWords,
      loreNotice: g.ows.loreNotice,
    };
  }
  if (g.mode === 'meme_battle' && g.meme) {
    const m = g.meme;
    const reveal = m.phase === 'reveal';
    const tallies = new Map<string, number>();
    for (const e of Object.values(m.votes)) tallies.set(e, (tallies.get(e) ?? 0) + 1);
    const mine = m.entries.find((e) => e.userId === viewerId);
    const myVote = viewerId ? m.votes[viewerId] : undefined;
    round = {
      mode: 'meme_battle',
      phase: m.phase,
      prompt: {
        kind: m.prompt.kind,
        text: m.prompt.text,
        imageUrl: m.prompt.imageUrl,
        imageOptions: m.prompt.imageOptions?.map((o) => o.url) ?? null,
      },
      gallery:
        m.phase === 'submitting'
          ? []
          : [...m.entries]
              .sort((a, b) => a.slot - b.slot)
              .map((e) => ({
                slot: e.slot,
                imageUrl: e.imageUrl,
                caption: e.caption,
                creator: reveal
                  ? {
                      type: e.creatorType,
                      userId: e.userId,
                      displayName:
                        e.creatorType === 'ai'
                          ? 'AI'
                          : (g.participants.find((p) => p.userId === e.userId)?.displayName ?? 'Someone'),
                    }
                  : null,
                votes: reveal ? (tallies.get(e.id) ?? 0) : null,
              })),
      submittedCount: m.entries.filter((e) => e.creatorType === 'human').length,
      votedCount: Object.keys(m.votes).length,
      mySubmitted: Boolean(mine),
      myVoteSlot: myVote ? (m.entries.find((e) => e.id === myVote)?.slot ?? null) : null,
      mySlot: m.phase !== 'submitting' ? (mine?.slot ?? null) : null,
      deadline: m.deadline ? new Date(m.deadline).toISOString() : null,
      loreNotice: m.loreNotice,
    };
  }
  if (g.mode === 'pictionary' && g.pict) {
    const p = g.pict;
    round = {
      mode: 'pictionary',
      drawerUserId: p.drawerUserId,
      prompt:
        viewerId === p.drawerUserId || g.state === 'round_results' || g.state === 'completed'
          ? p.prompt
          : null,
      hintLength: p.prompt.length,
      guesses: p.guesses.map((x) => ({
        ...x,
        text: x.correct && viewerId !== x.userId && g.state === 'active_round' ? '✓ guessed it' : x.text,
      })),
      solvedBy: p.solvedBy,
      deadline: p.deadline ? new Date(p.deadline).toISOString() : null,
      loreNotice: p.loreNotice,
    };
  }
  return {
    id: g.id,
    conversationId: g.conversationId,
    mode: g.mode,
    state: g.state,
    config: g.config,
    currentRound: g.round,
    hostUserId: g.hostUserId,
    participants: g.participants.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      team: p.team,
      score: p.score,
      ready: p.ready,
      color: colorOf.get(p.userId)!,
    })),
    round,
    result: g.result
      ? {
          title: g.result.title,
          text: g.result.text,
          imageUrl: resultImageUrl ?? g.result.imageUrl,
          imageAiGenerated: g.result.imageAiGenerated ?? false,
          winners: g.result.winners,
          words: g.mode === 'one_word_story' ? g.ows?.words : undefined,
        }
      : null,
    youAreIn: Boolean(viewerId && g.participants.some((p) => p.userId === viewerId)),
    updatedAt: new Date(g.updatedAt).toISOString(),
  };
}
