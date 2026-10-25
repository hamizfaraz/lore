import * as ai from '@lore/ai';
import { memeEntries, memeVotes } from '@lore/db';
import type { GameActionBody } from '@lore/shared/dto/games';
import { uuidv7 } from '@lore/shared/ids';
import sharp from 'sharp';
import { getDb } from '../../lib/db';
import { logger } from '../../lib/logger';
import * as media from '../media/service';
import { type GameRuntime, GameError, type MemeEntry, type MemeState } from './engine';
import { pick } from './words';

/** Meme Battle [C1] (section 8.5): private submissions, AI entry labeled only after reveal, anonymous shuffled gallery, one vote each. */

const SUBMIT_MS = (g: GameRuntime) => Math.max(45, g.config.timerSec * 3) * 1000;
const VOTE_MS = (g: GameRuntime) => Math.max(20, g.config.timerSec) * 1000;
const AI_CAPTIONS = [
  'me explaining the plan for the 4th time',
  'nobody: / the group chat at 2am:',
  'this is fine. everything is fine.',
  'when the snacks arrive before the people',
  'certified weekend moment',
];

type Mutate = (
  id: string,
  fn: (g: GameRuntime) => Promise<GameRuntime> | GameRuntime,
) => Promise<GameRuntime>;
type Finalize = (id: string) => Promise<GameRuntime>;
type Sched = (g: GameRuntime) => void;

// ── pure rules ────────────────────────────────────────────────────────────────────────────────
export function startRound(g: GameRuntime, now: number, notice: string | null): GameRuntime {
  const round = g.round + 1;
  const p = g.prompts[round - 1] ?? g.prompts[0];
  const kind: 'image' | 'caption' = round % 2 === 1 ? 'image' : 'caption';
  const meme: MemeState = {
    phase: 'submitting',
    prompt: {
      kind,
      text: p?.prompt ?? 'Caption this',
      imageUrl: null,
      imageMediaId: null,
      imageOptions: kind === 'caption' ? [] : null,
    },
    entries: [],
    votes: {},
    deadline: now + SUBMIT_MS(g),
    loreNotice: notice,
  };
  return { ...g, state: 'active_round', round, meme, lastActionAt: now, updatedAt: now };
}

export function submitEntry(
  g: GameRuntime,
  userId: string,
  entry: { caption: string; imageUrl: string | null; imageMediaId: string | null },
  now: number,
): GameRuntime {
  const m = g.meme;
  if (!m || m.phase !== 'submitting') throw new GameError('CONFLICT', 'Submissions are closed');
  if (!g.participants.some((p) => p.userId === userId))
    throw new GameError('FORBIDDEN', 'Join the game first');
  if (m.entries.some((e) => e.userId === userId)) throw new GameError('CONFLICT', 'You already submitted');
  const caption = entry.caption.trim().slice(0, 140);
  if (!caption) throw new GameError('BAD_REQUEST', 'Write a caption');
  const e: MemeEntry = {
    id: uuidv7(),
    slot: -1,
    creatorType: 'human',
    userId,
    caption,
    imageUrl: entry.imageUrl,
    imageMediaId: entry.imageMediaId,
  };
  return { ...g, meme: { ...m, entries: [...m.entries, e] }, lastActionAt: now, updatedAt: now };
}

export function addAiEntry(
  g: GameRuntime,
  entry: { caption: string; imageUrl: string | null; imageMediaId: string | null },
): GameRuntime {
  const m = g.meme;
  if (!m || m.phase !== 'submitting' || m.entries.some((e) => e.creatorType === 'ai')) return g;
  return {
    ...g,
    meme: {
      ...m,
      entries: [...m.entries, { id: uuidv7(), slot: -1, creatorType: 'ai', userId: null, ...entry }],
    },
  };
}

export const allSubmitted = (g: GameRuntime) =>
  g.participants.every((p) => g.meme!.entries.some((e) => e.userId === p.userId));
export const allVoted = (g: GameRuntime) => g.participants.every((p) => g.meme!.votes[p.userId]);

/** Gallery is shuffled server-side with anon_slot. */
export function beginVoting(g: GameRuntime, now: number, rng = Math.random): GameRuntime {
  const m = g.meme!;
  const order = m.entries.map((e) => ({ e, r: rng() })).sort((a, b) => a.r - b.r);
  const entries = order.map(({ e }, i) => ({ ...e, slot: i + 1 }));
  return {
    ...g,
    meme: { ...m, phase: entries.length ? 'voting' : 'reveal', entries, deadline: now + VOTE_MS(g) },
    updatedAt: now,
  };
}

export function castVote(g: GameRuntime, voterId: string, slot: number, now: number): GameRuntime {
  const m = g.meme;
  if (!m || m.phase !== 'voting') throw new GameError('CONFLICT', 'Voting is closed');
  if (!g.participants.some((p) => p.userId === voterId))
    throw new GameError('FORBIDDEN', 'Join the game first');
  if (m.votes[voterId]) throw new GameError('CONFLICT', 'You already voted');
  const entry = m.entries.find((e) => e.slot === slot);
  if (!entry) throw new GameError('BAD_REQUEST', 'No such entry');
  if (!g.config.allowSelfVote && entry.userId === voterId)
    throw new GameError('FORBIDDEN', "You can't vote for your own meme");
  return {
    ...g,
    meme: { ...m, votes: { ...m.votes, [voterId]: entry.id } },
    lastActionAt: now,
    updatedAt: now,
  };
}

/** Tallies stay hidden until all votes or the timer; reveal shows winner and authors. */
export function reveal(g: GameRuntime, now: number): GameRuntime {
  const m = g.meme!;
  const tally = new Map<string, number>();
  for (const id of Object.values(m.votes)) tally.set(id, (tally.get(id) ?? 0) + 1);
  const participants = g.participants.map((p) => {
    const mine = m.entries.find((e) => e.userId === p.userId);
    return mine ? { ...p, score: p.score + 100 * (tally.get(mine.id) ?? 0) } : p;
  });
  return {
    ...g,
    state: 'round_results',
    participants,
    meme: { ...m, phase: 'reveal', deadline: null },
    updatedAt: now,
  };
}

// ── effects ───────────────────────────────────────────────────────────────────────────────────
async function textImage(text: string, palette = ['#FBF3E6', '#1E2A44']): Promise<Buffer> {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="100%" height="100%" fill="${palette[0]}"/><circle cx="820" cy="260" r="160" fill="#FF5A4E" opacity="0.85"/><circle cx="300" cy="760" r="220" fill="#F6B94A" opacity="0.7"/><text x="540" y="560" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="54" fill="${palette[1]}">${esc(text.slice(0, 40))}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function promptImage(prompt: string): Promise<{ url: string; mediaId: string }> {
  let buf: Buffer;
  let aiMade = false;
  try {
    buf = (await ai.games.memeImage({ prompt })).image;
    aiMade = true;
  } catch {
    buf = await textImage(prompt);
  }
  const m = await media.createFromBuffer(buf, {
    kind: aiMade ? 'generated_image' : 'render',
    mime: 'image/png',
    aiGenerated: aiMade,
    generator: aiMade ? 'muse-image-1.0' : null,
  });
  return { url: m.url, mediaId: m.id };
}

/** Generate the round's prompt image(s) and the AI entry in parallel (never blocks the round start). */
export async function afterRoundStart(id: string, mutate: Mutate) {
  try {
    const { load } = await import('./service');
    const g = await load(id);
    const m = g.meme!;
    const round = g.round;
    const imgs =
      m.prompt.kind === 'image'
        ? [await promptImage(m.prompt.text ?? 'meme')]
        : await Promise.all([0, 1, 2].map((i) => promptImage(`${m.prompt.text} #${i + 1}`)));
    await mutate(id, (g) =>
      g.round !== round || !g.meme
        ? g
        : {
            ...g,
            meme: {
              ...g.meme,
              prompt: {
                ...g.meme.prompt,
                imageUrl: m.prompt.kind === 'image' ? imgs[0].url : null,
                imageMediaId: m.prompt.kind === 'image' ? imgs[0].mediaId : null,
                imageOptions: m.prompt.kind === 'caption' ? imgs : null,
              },
            },
          },
    );
    if (g.config.aiCompetitor) {
      let caption = pick(AI_CAPTIONS);
      try {
        caption = (await ai.games.memeEntry({ promptText: m.prompt.text, imageCaption: null })).caption;
      } catch {}
      await mutate(id, (g) =>
        g.round !== round
          ? g
          : addAiEntry(g, {
              caption: m.prompt.kind === 'caption' ? (m.prompt.text ?? caption) : caption,
              imageUrl: imgs[0].url,
              imageMediaId: imgs[0].mediaId,
            }),
      );
    }
  } catch (err) {
    logger.warn({ err }, 'meme afterRoundStart failed');
  }
}

async function persistRound(g: GameRuntime) {
  const m = g.meme!;
  if (m.entries.length)
    await getDb()
      .insert(memeEntries)
      .values(
        m.entries.map((e) => ({
          id: e.id,
          sessionId: g.id,
          round: g.round,
          creatorType: e.creatorType,
          creatorUserId: e.userId,
          imageMediaId: e.imageMediaId,
          caption: e.caption,
          anonSlot: e.slot,
        })),
      )
      .onConflictDoNothing()
      .catch(() => {});
  const votes = Object.entries(m.votes);
  if (votes.length)
    await getDb()
      .insert(memeVotes)
      .values(
        votes.map(([voter, entryId]) => ({ sessionId: g.id, round: g.round, voterUserId: voter, entryId })),
      )
      .onConflictDoNothing()
      .catch(() => {});
}

export async function act(
  id: string,
  userId: string,
  body: GameActionBody,
  mutate: Mutate,
  finalize: Finalize,
  sched: Sched,
): Promise<GameRuntime> {
  const now = Date.now();
  if (body.type === 'submit_meme') {
    let g = await mutate(id, (g) => {
      const m = g.meme;
      const optIdx = Number(body.payload.imageOption ?? 0);
      const img =
        m?.prompt.kind === 'caption'
          ? m.prompt.imageOptions?.[optIdx]
          : { url: m?.prompt.imageUrl ?? null, mediaId: m?.prompt.imageMediaId ?? null };
      const caption =
        m?.prompt.kind === 'caption' ? (m.prompt.text ?? '') : String(body.payload.caption ?? '');
      return submitEntry(
        g,
        userId,
        { caption, imageUrl: img?.url ?? null, imageMediaId: img?.mediaId ?? null },
        now,
      );
    });
    if (allSubmitted(g)) {
      g = await mutate(id, (g) => (g.meme?.phase === 'submitting' ? beginVoting(g, Date.now()) : g));
      sched(g);
    }
    return g;
  }
  if (body.type === 'vote_meme') {
    let g = await mutate(id, (g) => castVote(g, userId, Number(body.payload.slot), now));
    if (allVoted(g)) {
      g = await mutate(id, (g) => (g.meme?.phase === 'voting' ? reveal(g, Date.now()) : g));
      await persistRound(g);
    }
    return g;
  }
  // next_round (host)
  const g = await mutate(id, (g) => {
    if (g.hostUserId !== userId) throw new GameError('FORBIDDEN', 'Only the host can continue');
    if (g.state !== 'round_results') throw new GameError('CONFLICT', 'Finish this round first');
    if (g.round >= g.config.rounds) return { ...g, state: 'completed' as const, updatedAt: Date.now() };
    return startRound(g, Date.now(), g.meme?.loreNotice ?? null);
  });
  if (g.state === 'completed') return finalize(id);
  sched(g);
  void afterRoundStart(id, mutate);
  return g;
}

export async function onTimer(
  id: string,
  key: string,
  mutate: Mutate,
  _finalize: Finalize,
  sched: Sched,
): Promise<GameRuntime> {
  const g = await mutate(id, (g) => {
    if (`r${g.round}:${g.meme?.phase}` !== key) return g;
    if (g.meme!.phase === 'submitting') return beginVoting(g, Date.now());
    if (g.meme!.phase === 'voting') return reveal(g, Date.now());
    return g;
  });
  if (g.meme?.phase === 'voting') sched(g);
  if (g.meme?.phase === 'reveal') await persistRound(g);
  return g;
}

export async function result(g: GameRuntime): Promise<NonNullable<GameRuntime['result']>> {
  const top = Math.max(...g.participants.map((p) => p.score));
  const winners = g.participants.filter((p) => p.score === top && top > 0).map((p) => p.userId);
  const best = g.meme?.entries
    .slice()
    .sort(
      (a, b) =>
        Object.values(g.meme!.votes).filter((v) => v === b.id).length -
        Object.values(g.meme!.votes).filter((v) => v === a.id).length,
    )[0];
  return {
    title: 'Meme Battle',
    text: best ? `“${best.caption}”` : null,
    imageUrl: null,
    imageMediaId: best?.imageMediaId ?? null,
    winners,
  };
}
