import { randomBytes } from 'node:crypto';
import { and, desc, eq, gameSessions, gameTurns, inArray } from '@lore/db';
import type { CreateGameBody, GameActionBody, GameConfig, GameStateDTO } from '@lore/shared/dto/games';
import { zGameConfig } from '@lore/shared/dto/games';
import { rooms } from '@lore/shared/events';
import { uuidv7 } from '@lore/shared/ids';
import sharp from 'sharp';
import { getDb } from '../../lib/db';
import { flags } from '../../lib/env';
import { AppError, badRequest, forbidden, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { enqueue } from '../../lib/queues';
import { getRedis } from '../../lib/redis';
import { emit } from '../../lib/socket';
import * as chat from '../chat/service';
import * as groups from '../groups/service';
import * as media from '../media/service';
import * as social from '../social/service';
import * as users from '../users/service';
import * as E from './engine';
import * as P from './prompts';
import * as meme from './meme';
import * as pict from './pictionary';

/** games business logic [C1]: runtime in Valkey (`game:{id}`) mirrored to Postgres on every change (section 8.5). */

const KEY = (id: string) => `game:${id}`;

function toAppError(err: unknown): never {
  if (err instanceof E.GameError) throw new AppError(err.code, err.message);
  throw err;
}

// ── persistence ──────────────────────────────────────────────────────────────────────────────
export async function load(id: string): Promise<E.GameRuntime> {
  const raw = await getRedis()
    .get(KEY(id))
    .catch(() => null);
  if (raw) return JSON.parse(raw) as E.GameRuntime;
  const [row] = await getDb().select().from(gameSessions).where(eq(gameSessions.id, id)).limit(1);
  const runtime = (row?.result as { runtime?: E.GameRuntime } | null)?.runtime;
  if (!runtime) throw notFound('Game not found');
  return runtime;
}

async function save(g: E.GameRuntime) {
  await getRedis()
    .set(KEY(g.id), JSON.stringify(g), 'EX', 7 * 24 * 3600)
    .catch((err) => logger.warn({ err }, 'game cache write failed'));
  await getDb()
    .update(gameSessions)
    .set({
      state: g.state,
      currentRound: g.round,
      result: { runtime: g, final: g.result },
      resultMediaId: g.result?.imageMediaId ?? null,
      lastActionAt: new Date(g.lastActionAt),
    })
    .where(eq(gameSessions.id, g.id));
}

async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  const token = randomBytes(8).toString('hex');
  for (let i = 0; i < 100; i++) {
    const ok = await redis.set(`${KEY(id)}:lock`, token, 'PX', 8000, 'NX');
    if (ok) {
      try {
        return await fn();
      } finally {
        const cur = await redis.get(`${KEY(id)}:lock`);
        if (cur === token) await redis.del(`${KEY(id)}:lock`);
      }
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new AppError('CONFLICT', 'Game is busy, try again');
}

/** Load → mutate → save → broadcast caller-filtered views. All state changes go through here. */
async function mutate(
  id: string,
  fn: (g: E.GameRuntime) => Promise<E.GameRuntime> | E.GameRuntime,
): Promise<E.GameRuntime> {
  const next = await withLock(id, async () => {
    const g = await load(id);
    let n: E.GameRuntime;
    try {
      n = await fn(g);
    } catch (err) {
      toAppError(err);
    }
    if (n !== g) await save(n);
    return n;
  });
  void broadcast(next);
  return next;
}

async function resultUrl(g: E.GameRuntime) {
  return g.result?.imageMediaId ? media.signedUrl(g.result.imageMediaId) : null;
}

/** game.state is caller-filtered, so each member gets their own payload on their user room. */
export async function broadcast(g: E.GameRuntime) {
  try {
    const members = await chat.activeMembers(g.conversationId);
    const img = await resultUrl(g);
    for (const m of members) emit(rooms.user(m.userId), 'game.state', E.viewFor(g, m.userId, img));
  } catch (err) {
    logger.warn({ err }, 'game broadcast failed');
  }
}

export async function view(id: string, viewerId: string): Promise<GameStateDTO> {
  const g = await load(id);
  await chat.requireMember(g.conversationId, viewerId);
  return E.viewFor(g, viewerId, await resultUrl(g));
}

async function participantCard(userId: string) {
  const c = (await users.userCards([userId])).get(userId)!;
  return { userId, displayName: c.displayName, avatarUrl: c.avatarUrl };
}

async function assertCanPlay(conversationId: string, userId: string) {
  const m = await chat.requireMember(conversationId, userId);
  if (m.muteUntil && m.muteUntil > new Date() && m.muteScope === 'games')
    throw forbidden('An admin paused games for you for now');
}

// ── lifecycle ────────────────────────────────────────────────────────────────────────────────
export async function create(userId: string, body: CreateGameBody): Promise<GameStateDTO> {
  await assertCanPlay(body.conversationId, userId);
  if (body.mode === 'meme_battle' && !flags.FEATURE_GAMES_MEME)
    throw badRequest('Meme Battle is not enabled');
  if (body.mode === 'pictionary' && !flags.FEATURE_GAMES_PICTIONARY)
    throw badRequest('Pictionary is not enabled');
  const config: GameConfig = zGameConfig.parse(body.config ?? {});
  const id = uuidv7();
  const now = Date.now();
  let g = E.newRuntime({
    id,
    conversationId: body.conversationId,
    mode: body.mode,
    config,
    host: await participantCard(userId),
    now,
  });
  // Prompts are prefetched at lobby creation so rounds never wait on the model (section 8.5).
  if (body.mode !== 'one_word_story') {
    const r = await P.getPrompts(body.conversationId, body.mode, config.contextSource, config.rounds);
    g = { ...g, prompts: r.prompts, usedLore: r.usedLore };
  } else {
    const mem = await P.permittedMemories(body.conversationId).catch(() => []);
    g = { ...g, usedLore: P.shouldUseLore(config.contextSource, mem.length) };
  }
  await getDb()
    .insert(gameSessions)
    .values({
      id,
      conversationId: body.conversationId,
      mode: body.mode,
      state: 'lobby',
      config,
      currentRound: 0,
      hostUserId: userId,
      result: { runtime: g },
    });
  await save(g);
  await chat.postMessage(
    body.conversationId,
    { kind: 'card', cardKind: 'game_invite', cardRefId: id },
    { type: 'user', userId },
  );
  void enqueue('games.tick', { gameId: id, kind: 'abandon' }, { delayMs: E.ABANDON_MS + 1000 });
  return E.viewFor(g, userId);
}

export async function join(id: string, userId: string) {
  const g0 = await load(id);
  await assertCanPlay(g0.conversationId, userId);
  const card = await participantCard(userId);
  const g = await mutate(id, (g) => E.join(g, card, Date.now()));
  return E.viewFor(g, userId);
}

export async function start(id: string, userId: string) {
  const g = await mutate(id, async (g) => {
    if (g.hostUserId !== userId) throw new E.GameError('FORBIDDEN', 'Only the host can start');
    const notice = g.config.contextSource === 'random' || g.usedLore ? null : P.LORE_NOTICE;
    if (g.mode === 'one_word_story')
      return E.startOws(
        g,
        await P.fiveWords(g.conversationId, [], g.config.contextSource),
        Date.now(),
        notice,
      );
    if (g.mode === 'meme_battle') return meme.startRound(g, Date.now(), notice);
    return pict.startRound(g, Date.now(), notice);
  });
  scheduleTimer(g);
  if (g.mode === 'one_word_story') void prefetchNext(id);
  if (g.mode === 'meme_battle') void meme.afterRoundStart(id, mutate);
  return E.viewFor(g, userId);
}

function scheduleTimer(g: E.GameRuntime) {
  const deadline = g.ows?.deadline ?? g.meme?.deadline ?? g.pict?.deadline;
  if (!deadline || g.state !== 'active_round') return;
  const key =
    g.mode === 'one_word_story'
      ? `t${g.ows!.turnIndex}`
      : g.mode === 'meme_battle'
        ? `r${g.round}:${g.meme!.phase}`
        : `r${g.round}`;
  void enqueue(
    'games.tick',
    { gameId: g.id, kind: 'timer', key },
    { delayMs: Math.max(0, deadline - Date.now()) + 250 },
  ).catch(() => {});
}

function timerKey(g: E.GameRuntime) {
  return g.mode === 'one_word_story'
    ? `t${g.ows?.turnIndex}`
    : g.mode === 'meme_battle'
      ? `r${g.round}:${g.meme?.phase}`
      : `r${g.round}`;
}

/** Prefetch the next player's five words while the current one chooses (section 8.5). */
async function prefetchNext(id: string) {
  try {
    const g = await load(id);
    if (g.state !== 'active_round' || !g.ows) return;
    const words = await P.fiveWords(
      g.conversationId,
      g.ows.words.map((w) => w.word),
      g.config.contextSource,
    );
    await withLock(id, async () => {
      const cur = await load(id);
      if (cur.ows && cur.ows.turnIndex === g.ows!.turnIndex)
        await save({ ...cur, ows: { ...cur.ows, nextChoices: words } });
    });
  } catch (err) {
    logger.warn({ err }, 'prefetch five words failed');
  }
}

function usableNext(prefetched: string[] | null, story: string[]): string[] | null {
  if (!prefetched) return null;
  return E.validFiveWords(prefetched, story) ? prefetched : null;
}

export async function act(id: string, userId: string, body: GameActionBody) {
  const g0 = await load(id);
  await chat.requireMember(g0.conversationId, userId);
  const now = Date.now();
  let g: E.GameRuntime;
  switch (body.type) {
    case 'choose_word': {
      const word = String(body.payload.word ?? '');
      g = await mutate(id, async (g) => {
        const story = [...(g.ows?.words.map((w) => w.word) ?? []), word];
        const next =
          usableNext(g.ows?.nextChoices ?? null, story) ??
          (story.length >= g.config.maxWords
            ? []
            : await P.fiveWords(g.conversationId, story, g.config.contextSource));
        return E.chooseWord(g, userId, word, next, now);
      });
      await recordTurn(g, userId, word);
      if (g.state === 'completed') g = await finalize(id);
      else {
        scheduleTimer(g);
        void prefetchNext(id);
      }
      break;
    }
    case 'end':
      g = await mutate(id, (g) => E.endByHost(g, userId, now));
      if (g.state === 'completed') g = await finalize(id);
      break;
    case 'submit_meme':
    case 'vote_meme':
    case 'next_round':
      g = await meme.act(id, userId, body, mutate, finalize, scheduleTimer);
      break;
    case 'guess':
    case 'skip':
      g = await pict.act(id, userId, body, mutate, finalize, scheduleTimer);
      break;
    case 'share_story':
    case 'propose_group':
    case 'save_to_chat':
      return share(id, userId, body.type, body.payload);
    default:
      throw badRequest('Unsupported action');
  }
  return E.viewFor(g, userId, await resultUrl(g));
}

async function recordTurn(g: E.GameRuntime, userId: string, answer: string) {
  await getDb()
    .insert(gameTurns)
    .values({
      id: uuidv7(),
      sessionId: g.id,
      round: g.round,
      activeUserId: userId,
      prompt: null,
      choices: [],
      answer,
      completedAt: new Date(),
    })
    .catch(() => {});
}

/** Timer and abandonment ticks (BullMQ delayed jobs). */
export async function tick(data: { gameId: string; kind: 'timer' | 'abandon'; key?: string }) {
  const g0 = await load(data.gameId).catch(() => null);
  if (!g0 || g0.state === 'completed' || g0.state === 'abandoned') return;
  if (data.kind === 'abandon') {
    const g = await mutate(data.gameId, (g) => E.maybeAbandon(g, Date.now()));
    if (g.state !== 'abandoned' && g.state !== 'completed')
      void enqueue(
        'games.tick',
        { gameId: g.id, kind: 'abandon' },
        { delayMs: Math.max(5_000, g.lastActionAt + E.ABANDON_MS - Date.now() + 1000) },
      );
    return;
  }
  if (timerKey(g0) !== data.key) return;
  let g: E.GameRuntime;
  if (g0.mode === 'one_word_story') {
    g = await mutate(data.gameId, async (g) => {
      if (timerKey(g) !== data.key) return g;
      const story = g.ows!.words.map((w) => w.word);
      return E.skipTurn(
        g,
        usableNext(g.ows!.nextChoices, story) ??
          (await P.fiveWords(g.conversationId, story, g.config.contextSource)),
        Date.now(),
      );
    });
    if (timerKey(g) !== data.key) {
      scheduleTimer(g);
      void prefetchNext(g.id);
    }
  } else if (g0.mode === 'meme_battle')
    g = await meme.onTimer(data.gameId, data.key!, mutate, finalize, scheduleTimer);
  else g = await pict.onTimer(data.gameId, data.key!, mutate, finalize, scheduleTimer);
}

/** Completion: title + illustration + result card (`game_result`). Abandoned games never get here. */
async function finalize(id: string): Promise<E.GameRuntime> {
  const g0 = await load(id);
  if (g0.state !== 'completed' || g0.result) return g0;
  let result: NonNullable<E.GameRuntime['result']>;
  if (g0.mode === 'one_word_story') {
    const words = g0.ows?.words.map((w) => w.word) ?? [];
    const text = words.join(' ');
    const title = await P.storyTitle(words);
    const img = await P.storyImage(text, title);
    const buf = img?.image ?? (await textCard(title, text));
    const m = await media.createFromBuffer(buf, {
      ownerUserId: null,
      kind: img ? 'generated_image' : 'render',
      mime: img?.mime ?? 'image/png',
      aiGenerated: Boolean(img),
      generator: img ? 'muse-image-1.0' : null,
    });
    result = { title, text, imageUrl: null, imageMediaId: m.id, winners: [], imageAiGenerated: Boolean(img) };
  } else if (g0.mode === 'meme_battle') {
    result = await meme.result(g0);
  } else {
    result = pict.result(g0);
  }
  const g = await mutate(id, (g) => ({ ...g, result }));
  await chat.postMessage(
    g.conversationId,
    { kind: 'card', cardKind: 'game_result', cardRefId: g.id },
    { type: 'system' },
  );
  return g;
}

/** Typographic fallback card (not AI) for when Muse Image is unavailable. */
async function textCard(title: string, text: string): Promise<Buffer> {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if ((line + w).length > 26) {
      lines.push(line.trim());
      line = '';
    }
    line += `${w} `;
  }
  if (line.trim()) lines.push(line.trim());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="100%" height="100%" fill="#FBF3E6"/>
  <rect x="60" y="60" width="960" height="1230" rx="40" fill="none" stroke="#FF5A4E" stroke-width="6"/>
  <text x="540" y="260" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="64" fill="#1E2A44">${esc(title.slice(0, 40))}</text>
  ${lines
    .slice(0, 14)
    .map(
      (l, i) =>
        `<text x="540" y="${420 + i * 62}" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="#1E2A44">${esc(l)}</text>`,
    )
    .join('')}
  <text x="540" y="1230" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="40" fill="#FF5A4E">lore · one-word story</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** End screen: Save to chat (result card already posted), Share to my story, Propose to group account. */
async function share(id: string, userId: string, type: string, payload: Record<string, unknown>) {
  const g = await load(id);
  await chat.requireMember(g.conversationId, userId);
  if (!E.canShareResult(g) || !g.result?.imageMediaId) throw badRequest('Only finished games can be shared');
  if (type === 'save_to_chat') return { ok: true };
  if (type === 'share_story') {
    const acct = await users.requirePersonalAccount(userId);
    await social.insertStory(acct.id, userId, g.result.imageMediaId, g.result.title);
    return { ok: true };
  }
  const accountId = String(payload.accountId ?? '');
  const draft = await groups.createDraft(
    {
      accountId,
      conversationId: g.conversationId,
      kind: 'photo',
      caption: [g.result.title, g.result.text].filter(Boolean).join('\n\n'),
      mediaIds: [g.result.imageMediaId],
      source: { kind: 'game', id: g.id },
      submit: true,
    },
    { type: 'user', userId },
  );
  return { ok: true, draftId: draft.id };
}

export async function activeGames(conversationId: string, userId: string) {
  await chat.requireMember(conversationId, userId);
  const rows = await getDb()
    .select({ id: gameSessions.id })
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.conversationId, conversationId),
        inArray(gameSessions.state, ['lobby', 'active_round', 'round_results']),
      ),
    )
    .orderBy(desc(gameSessions.createdAt))
    .limit(10);
  return Promise.all(rows.map((r) => view(r.id, userId)));
}

export async function sweep() {
  const rows = await getDb()
    .select({ id: gameSessions.id })
    .from(gameSessions)
    .where(inArray(gameSessions.state, ['lobby', 'active_round', 'round_results']));
  for (const r of rows) await tick({ gameId: r.id, kind: 'abandon' }).catch(() => {});
}

export async function isParticipantOrMember(gameId: string, userId: string) {
  const g = await load(gameId).catch(() => null);
  return Boolean(g && (await chat.membership(g.conversationId, userId)));
}
