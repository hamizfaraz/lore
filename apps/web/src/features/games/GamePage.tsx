'use client';
import type { GameStateDTO } from '@lore/shared/dto/games';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpenText,
  Bot,
  Brush,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Flame,
  Gamepad2,
  Laugh,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { AiPill, Chip } from '@/components/ui/Labels';
import { ListRow } from '@/components/ui/ListRow';
import { Sheet } from '@/components/ui/Sheet';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { tap } from '@/lib/haptics';
import { useMe } from '@/lib/hooks';
import { toast } from '@/lib/store';
import { PictionaryCanvas } from './PictionaryCanvas';
import { StoryText } from './StoryText';
import { MODE_LABEL, useGame } from './useGame';

type Round<M extends string> = Extract<NonNullable<GameStateDTO['round']>, { mode: M }>;

/** Tension Progress Bar with Countdown Audio/Visual Tick */
function TensionBar({ deadline, totalSec = 20 }: { deadline: string | null; totalSec?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  if (!deadline) return null;
  const target = new Date(deadline).getTime();
  const left = Math.max(0, target - now);
  const leftSec = Math.ceil(left / 1000);
  const totalMs = totalSec * 1000;
  const pct = Math.min(100, Math.max(0, (left / totalMs) * 100));
  const isUrgent = left < 5000;

  return (
    <div className="relative w-full">
      <div className="h-1.5 w-full overflow-hidden bg-slate-800/80">
        <motion.div
          className={cn(
            'h-full transition-all duration-200',
            isUrgent
              ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e]'
              : left < 10000
                ? 'bg-amber-400'
                : 'bg-emerald-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="absolute right-3 top-2 flex items-center gap-1 rounded-full bg-slate-900/90 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-200 backdrop-blur-md">
        <Clock size={11} className={isUrgent ? 'animate-bounce text-rose-400' : 'text-slate-400'} />
        <span className={cn(isUrgent && 'text-rose-400 font-extrabold')}>{leftSec}s</span>
      </div>
    </div>
  );
}

/** Floating Reaction Particles */
function FloatingReactions() {
  const [particles, setParticles] = useState<{ id: number; emoji: string; x: number }[]>([]);

  const emit = (emoji: string) => {
    tap();
    const id = Date.now() + Math.random();
    const x = Math.floor(Math.random() * 60) + 20; // 20% to 80%
    setParticles((prev) => [...prev.slice(-8), { id, emoji, x }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1800);
  };

  return (
    <>
      {/* Active floating particles */}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, y: '85vh', x: `${p.x}vw`, scale: 0.6 }}
            animate={{ opacity: 0, y: '25vh', scale: 1.4 }}
            transition={{ duration: 1.7, ease: 'easeOut' }}
            className="absolute text-[32px] drop-shadow-lg"
          >
            {p.emoji}
          </motion.div>
        ))}
      </div>

      {/* Floating Reaction Bar */}
      <div className="flex items-center justify-center gap-2 py-1.5">
        {(['🔥', '💀', '😭', '🎯', '👏', '👀'] as const).map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => emit(emoji)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/80 text-[18px] backdrop-blur-md transition-transform hover:scale-115 active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * LORE Playmode Core Stage [C1 / Section 8.5].
 * Full-screen immersive party game shell over the chat.
 */
export function GamePage({ conversationId, gameId }: { conversationId: string; gameId: string }) {
  const router = useRouter();
  const me = useMe();
  const meId = me.data?.user.id ?? '';
  const { game: g, act, join, start } = useGame(gameId);
  const [shareOpen, setShareOpen] = useState(false);

  if (!g) {
    return (
      <div className="playmode-stage fixed inset-0 z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Gamepad2 size={40} className="animate-bounce text-violet-400" />
          <p className="font-display text-[16px] font-semibold text-slate-300">Entering Playmode…</p>
        </div>
      </div>
    );
  }

  const isHost = g.hostUserId === meId;
  const over = g.state === 'completed' || g.state === 'abandoned';
  const notice = g.round && 'loreNotice' in g.round ? g.round.loreNotice : null;
  const deadline = g.round && 'deadline' in g.round ? g.round.deadline : null;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      className="playmode-stage fixed inset-0 z-50 flex flex-col md:left-1/2 md:w-[480px] md:-translate-x-1/2 md:border-x md:border-slate-800"
    >
      {/* Top HUD */}
      <header className="relative flex items-center justify-between border-b border-slate-800/80 px-3 pb-2 pt-[calc(var(--safe-top)+6px)]">
        <button
          type="button"
          aria-label="Back to chat"
          onClick={() => {
            tap();
            router.push(`/c/${conversationId}`);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-slate-300 hover:text-white active:scale-95"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Gamepad2 size={14} className="text-violet-400" />
            <p className="font-display text-[16px] font-bold tracking-tight text-white">
              {MODE_LABEL[g.mode]}
            </p>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {g.state === 'lobby'
              ? 'Lobby'
              : over
                ? g.state === 'completed'
                  ? 'Victory Recap'
                  : 'Game Abandoned'
                : g.mode === 'one_word_story'
                  ? `${(g.round as Round<'one_word_story'>)?.words.length ?? 0} / ${g.config.maxWords} words`
                  : `Round ${g.currentRound} of ${g.mode === 'pictionary' ? g.config.rounds * g.participants.length : g.config.rounds}`}
          </p>
        </div>

        {isHost && !over ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              tap();
              act('end');
            }}
            className="rounded-xl border-slate-700 bg-slate-800/80 text-rose-400 hover:bg-slate-700 hover:text-rose-300"
          >
            End
          </Button>
        ) : (
          <div className="w-9" />
        )}
      </header>

      {/* Tension Progress Track */}
      {!over && g.state !== 'lobby' && <TensionBar deadline={deadline} totalSec={g.config.timerSec} />}

      {/* Horizontal Player Orbit Strip */}
      <div
        className="flex gap-2 overflow-x-auto border-b border-slate-800/60 px-3 py-2"
        aria-label="Players"
        data-hscroll
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {g.participants.map((p) => (
          <span
            key={p.userId}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900/90 py-1 pl-1 pr-2.5 text-[12px] font-medium text-slate-200 ring-1 ring-white/10"
          >
            <span
              className="rounded-full ring-2"
              style={{ ['--tw-ring-color' as string]: p.color || '#3b82f6' }}
            >
              <Avatar src={p.avatarUrl} name={p.displayName} size={22} />
            </span>
            <span>{p.displayName.split(' ')[0]}</span>
            {g.mode !== 'one_word_story' && (
              <b className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[11px] font-bold text-amber-400">
                {p.score}
              </b>
            )}
          </span>
        ))}
      </div>

      {/* Lore Inside Joke Notice */}
      {notice && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-950/40 px-3 py-2 text-[12px] text-purple-200">
          <Sparkles size={14} className="shrink-0 text-purple-400" />
          <p className="line-clamp-2">{notice}</p>
        </div>
      )}

      {/* Main Gameplay Stage Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {/* LOBBY VIEW */}
        {g.state === 'lobby' && (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            {/* Milo Host Mascot Avatar */}
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-xl ring-4 ring-violet-400/30">
                <Gamepad2 size={42} className="text-white drop-shadow-md" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-slate-900">
                <Sparkles size={12} />
              </span>
            </div>

            <div>
              <p className="font-display text-[22px] font-bold text-white">
                {g.participants.length} {g.participants.length === 1 ? 'Player' : 'Players'} in Lobby
              </p>
              <p className="mt-1 text-[13px] text-slate-400">
                Prompts from{' '}
                <span className="font-semibold text-violet-400">
                  {g.config.contextSource === 'lore' ? 'group lore & inside jokes' : g.config.contextSource}
                </span>{' '}
                · {g.config.timerSec}s turn timer
              </p>
            </div>

            {/* Lobby Action Controls */}
            <div className="w-full max-w-xs space-y-2.5">
              {!g.youAreIn && (
                <Button
                  block
                  size="lg"
                  onClick={() => {
                    tap();
                    join();
                  }}
                  className="btn-arcade bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                >
                  Join Game
                </Button>
              )}

              {isHost ? (
                <Button
                  block
                  size="lg"
                  onClick={() => {
                    tap();
                    start();
                  }}
                  disabled={g.participants.length < (g.mode === 'pictionary' ? 2 : 1)}
                  className="btn-arcade bg-gradient-to-r from-emerald-600 to-teal-600 text-white disabled:opacity-50"
                >
                  Start Game 🚀
                </Button>
              ) : (
                g.youAreIn && (
                  <div className="rounded-xl bg-slate-900/60 p-3 text-[13px] text-slate-400 ring-1 ring-white/10">
                    Waiting for the host to start the game…
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* ACTIVE GAMES */}
        {g.mode === 'one_word_story' && g.round?.mode === 'one_word_story' && g.state !== 'lobby' && (
          <OneWord g={g} r={g.round} meId={meId} act={act} />
        )}
        {g.mode === 'meme_battle' && g.round?.mode === 'meme_battle' && !over && (
          <Meme g={g} r={g.round} meId={meId} isHost={isHost} act={act} />
        )}
        {g.mode === 'pictionary' && g.round?.mode === 'pictionary' && !over && (
          <Pict g={g} r={g.round} meId={meId} isHost={isHost} act={act} />
        )}

        {/* VICTORY / RECAP PODIUM */}
        {g.state === 'completed' && g.result && (
          <div className="space-y-4 py-2">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-[12px] font-bold text-amber-400 ring-1 ring-amber-500/40">
                <Crown size={14} /> Final Result
              </span>
              <h2 className="mt-2 font-display text-[26px] font-bold text-white">
                {g.result.title ?? 'Party Recap'}
              </h2>
            </div>

            {/* Hero Artwork */}
            {g.result.imageUrl ? (
              <div className="relative overflow-hidden rounded-3xl border border-slate-700 bg-black shadow-2xl">
                <img
                  src={g.result.imageUrl}
                  alt={g.result.title ?? 'Artwork'}
                  className="aspect-[4/5] w-full object-cover"
                />
                {g.result.imageAiGenerated && (
                  <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                    ✨ AI Illustrated Ending
                  </div>
                )}
              </div>
            ) : (
              g.mode !== 'one_word_story' && (
                <div className="flex aspect-[4/5] items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 text-[13px] text-slate-400">
                  Generating AI illustration…
                </div>
              )
            )}

            {/* Result text */}
            {g.mode !== 'one_word_story' && g.result.text && (
              <div className="rounded-2xl bg-slate-900/80 p-3.5 text-[14px] leading-relaxed text-slate-200 ring-1 ring-white/10">
                {g.result.text}
              </div>
            )}

            <Button
              block
              size="lg"
              onClick={() => {
                tap();
                setShareOpen(true);
              }}
              className="btn-arcade gap-2 bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-slate-950"
            >
              <Share2 size={18} /> Share Recap
            </Button>
          </div>
        )}
      </div>

      {/* Floating Reactions Bar */}
      {!over && g.state !== 'lobby' && <FloatingReactions />}

      {/* Share Sheet */}
      <Sheet open={shareOpen} onOpenChange={setShareOpen} title="Share Victory Recap">
        <div className="space-y-1 pb-6">
          <ListRow
            title="Post Card in Chat"
            subtitle="Already dropped into the group chat stream"
            chevron={false}
            onClick={() => {
              setShareOpen(false);
              toast('Saved to chat');
            }}
          />
          <ListRow
            title="Share to My Story"
            subtitle="Post as a 24-hour story with interactive play sticker"
            onClick={async () => {
              const r = await act('share_story');
              setShareOpen(false);
              if (r) toast('Added to your story');
            }}
          />
          {(me.data?.groupAccounts ?? [])
            .filter((a) => a.conversationId === conversationId)
            .map((a) => (
              <ListRow
                key={a.id}
                title={`Propose to @${a.handle}`}
                subtitle="Creates a draft post for group approval"
                onClick={async () => {
                  const r = await act('propose_group', { accountId: a.id });
                  setShareOpen(false);
                  if (r) router.push(`/c/${conversationId}`);
                }}
              />
            ))}
        </div>
      </Sheet>

      {/* Mini-Chat Drawer */}
      <MiniChatTray conversationId={conversationId} />
    </motion.div>
  );
}

/** Mini-Chat Drawer: lets users read/send group messages without leaving the game */
function MiniChatTray({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const messages = useQuery({
    queryKey: ['game-chat', conversationId],
    queryFn: () =>
      api.get<{ items: { id: string; body: string | null }[] }>(
        `/v1/conversations/${conversationId}/messages`,
      ),
    enabled: open,
  });

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    tap();
    setText('');
    await api.post(`/v1/conversations/${conversationId}/messages`, { kind: 'text', body });
    void messages.refetch();
  };

  const recent = (messages.data?.items ?? []).slice(-4);

  return (
    <div className="border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
      <button
        type="button"
        className="flex min-h-[40px] w-full items-center justify-between px-4 text-left text-[12px] font-bold uppercase tracking-wider text-slate-400 hover:text-white"
        onClick={() => {
          tap();
          setOpen((v) => !v);
        }}
      >
        <span className="flex items-center gap-1.5">
          <MessageCircle size={14} className="text-violet-400" />
          Group Chat
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {open && (
        <div className="space-y-2 px-4 pb-3">
          <div className="max-h-24 space-y-1 overflow-y-auto">
            {recent.map((message) => (
              <p key={message.id} className="truncate text-[12px] text-slate-300">
                {message.body ?? 'Attachment'}
              </p>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message group…"
              className="h-[38px] flex-1 rounded-full bg-slate-800 px-4 text-[14px] text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500"
            />
            <Button size="sm" type="submit" className="rounded-full bg-violet-600 px-3 text-white">
              <Send size={14} />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

/** GAME 1: One-Word Story ("Story Forge") */
function OneWord({
  g,
  r,
  meId,
  act,
}: {
  g: GameStateDTO;
  r: Round<'one_word_story'>;
  meId: string;
  act: (t: string, p?: Record<string, unknown>) => Promise<unknown>;
}) {
  const active = g.participants.find((p) => p.userId === r.activeUserId);
  const mine = r.activeUserId === meId && r.choices;
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => setPicked(null), [r.words.length]);

  return (
    <div className="flex min-h-full flex-col justify-between space-y-4">
      {/* Living Story Text Card */}
      <div className="flex-1 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl backdrop-blur-md">
        {r.words.length ? (
          <StoryText words={r.words} participants={g.participants} big />
        ) : (
          <p className="font-display text-[22px] italic text-slate-400">The story begins with you…</p>
        )}
      </div>

      {/* Word Crystals Selection Tray */}
      {g.state === 'active_round' && (
        <div className="sticky bottom-0 space-y-3 pb-[calc(var(--safe-bottom)+8px)] pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold uppercase tracking-wider text-slate-300">
              {mine ? (
                <span className="text-violet-400">✨ Your Turn — Choose 1 Word:</span>
              ) : (
                `${active?.displayName.split(' ')[0] ?? 'Someone'} is choosing…`
              )}
            </span>
          </div>

          {mine && (
            <div className="grid grid-cols-2 gap-2">
              <AnimatePresence>
                {r.choices!.map((w, i) => (
                  <motion.button
                    key={w}
                    type="button"
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: i * 0.04 } }}
                    disabled={Boolean(picked)}
                    onClick={() => {
                      tap();
                      setPicked(w);
                      void act('choose_word', { word: w });
                    }}
                    className={cn(
                      'btn-arcade rounded-2xl border-2 py-3.5 text-[17px] font-bold tracking-wide transition-all',
                      i === 4 && 'col-span-2 bg-gradient-to-r from-violet-600/30 to-indigo-600/30',
                      picked === w
                        ? 'border-violet-400 bg-violet-600 text-white shadow-[0_0_20px_#8b5cf6]'
                        : 'border-slate-700 bg-slate-800/90 text-slate-100 hover:border-slate-500',
                    )}
                  >
                    {w}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** GAME 2: Meme Battle ("Meme Royale") */
function Meme({
  g,
  r,
  meId,
  isHost,
  act,
}: {
  g: GameStateDTO;
  r: Round<'meme_battle'>;
  meId: string;
  isHost: boolean;
  act: (t: string, p?: Record<string, unknown>) => Promise<unknown>;
}) {
  const [caption, setCaption] = useState('');
  const [opt, setOpt] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-slate-800 px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-slate-300">
          {r.phase === 'submitting'
            ? `${r.submittedCount}/${g.participants.length} submitted`
            : r.phase === 'voting'
              ? `${r.votedCount}/${g.participants.length} voted`
              : 'Reveal Phase'}
        </span>
      </div>

      {/* PHASE 1: SUBMITTING */}
      {r.phase === 'submitting' && (
        <div className="space-y-3">
          {r.prompt.kind === 'image' ? (
            <>
              {/* Meme Live Canvas Preview */}
              <div className="relative overflow-hidden rounded-3xl border border-slate-700 bg-black shadow-2xl">
                {r.prompt.imageUrl ? (
                  <img src={r.prompt.imageUrl} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="aspect-square w-full animate-pulse bg-slate-800" />
                )}
                {/* Live Caption Overlay Preview */}
                {caption && (
                  <div className="pointer-events-none absolute inset-x-2 bottom-3 rounded-lg bg-black/60 p-2 text-center font-display text-[18px] font-extrabold uppercase tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                    {caption}
                  </div>
                )}
              </div>

              <p className="text-[12px] font-medium text-slate-400">Prompt: {r.prompt.text}</p>

              {!r.mySubmitted && (
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={120}
                  rows={2}
                  placeholder="Type your funniest meme caption…"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 p-3 text-[16px] text-white outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                />
              )}
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="font-display text-[20px] font-bold text-white">“{r.prompt.text}”</p>
                <p className="mt-1 text-[12px] text-slate-400">Pick the best matching meme image:</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(r.prompt.imageOptions ?? []).map((u, i) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      tap();
                      setOpt(i);
                    }}
                    className={cn(
                      'overflow-hidden rounded-2xl border-2 transition-transform active:scale-95',
                      opt === i
                        ? 'border-rose-500 ring-2 ring-rose-500/50'
                        : 'border-transparent opacity-80 hover:opacity-100',
                    )}
                  >
                    <img src={u} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}

          {r.mySubmitted ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900/80 p-4 text-[13px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
              <Check size={16} /> Submitted privately. Waiting for opponents…
            </div>
          ) : (
            <Button
              block
              size="lg"
              disabled={r.prompt.kind === 'image' && !caption.trim()}
              onClick={() => {
                tap();
                act('submit_meme', { caption, imageOption: opt });
              }}
              className="btn-arcade bg-gradient-to-r from-rose-600 to-amber-600 text-white disabled:opacity-50"
            >
              Submit Privately 🔒
            </Button>
          )}
        </div>
      )}

      {/* PHASE 2 & 3: VOTING & REVEAL GALLERY */}
      {r.phase !== 'submitting' && (
        <div className="grid grid-cols-2 gap-3">
          {r.gallery.map((e) => {
            const isVoted = r.myVoteSlot === e.slot;
            const isMine = r.mySlot === e.slot;

            return (
              <div
                key={e.slot}
                className={cn(
                  'overflow-hidden rounded-2xl border bg-slate-900/90 shadow-lg transition-all',
                  isVoted ? 'border-rose-400 ring-2 ring-rose-500/40' : 'border-slate-800',
                )}
              >
                {e.imageUrl && <img src={e.imageUrl} alt="" className="aspect-square w-full object-cover" />}
                <div className="p-2.5">
                  <p className="text-[13px] font-bold leading-tight text-white">{e.caption}</p>
                </div>

                {r.phase === 'voting' ? (
                  <button
                    type="button"
                    disabled={r.myVoteSlot !== null || isMine}
                    onClick={() => {
                      tap();
                      act('vote_meme', { slot: e.slot });
                    }}
                    className={cn(
                      'w-full border-t border-slate-800 py-2.5 text-[12px] font-bold uppercase tracking-wider transition-colors',
                      isMine
                        ? 'text-slate-500'
                        : isVoted
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'text-rose-400 hover:bg-rose-500/10 active:scale-95',
                    )}
                  >
                    {isMine ? (
                      'Your Entry'
                    ) : isVoted ? (
                      <span className="inline-flex items-center gap-1">
                        <Check size={14} /> Voted
                      </span>
                    ) : (
                      'Vote Entry'
                    )}
                  </button>
                ) : (
                  /* Reveal Phase */
                  <div className="flex items-center justify-between border-t border-slate-800 px-2.5 py-2 text-[12px]">
                    <span className="flex items-center gap-1 font-semibold text-slate-300">
                      {e.creator?.type === 'ai' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                          <Bot size={11} /> Milo AI
                        </span>
                      ) : (
                        e.creator?.displayName
                      )}
                    </span>
                    <b className="text-amber-400">{e.votes} ❤</b>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {r.phase === 'reveal' && isHost && (
        <Button
          block
          size="lg"
          onClick={() => {
            tap();
            act('next_round');
          }}
          className="btn-arcade bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
        >
          {g.currentRound >= g.config.rounds ? 'Finish Match 🏆' : 'Next Round ⚡'}
        </Button>
      )}

      {r.phase === 'reveal' && !isHost && (
        <p className="text-center text-[12px] text-slate-400">Waiting for host to advance…</p>
      )}

      {r.phase === 'voting' && (
        <p className="text-center text-[11px] text-slate-400">
          Entries are anonymous until all players vote.
        </p>
      )}
    </div>
  );
}

/** GAME 3: Pictionary ("Doodle Duel") */
function Pict({
  g,
  r,
  meId,
  isHost,
  act,
}: {
  g: GameStateDTO;
  r: Round<'pictionary'>;
  meId: string;
  isHost: boolean;
  act: (t: string, p?: Record<string, unknown>) => Promise<unknown>;
}) {
  const [guess, setGuess] = useState('');
  const drawer = g.participants.find((p) => p.userId === r.drawerUserId);
  const isDrawer = r.drawerUserId === meId;

  return (
    <div className="space-y-3">
      {/* Drawer / Guesser Telemetry */}
      <div className="flex items-center justify-between rounded-2xl bg-slate-900/80 px-3.5 py-2.5 ring-1 ring-white/10">
        <span className="text-[13px] font-semibold text-slate-200">
          {isDrawer ? (
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Brush size={16} /> Draw Prompt:{' '}
              <span className="font-display text-[17px] font-bold text-white">{r.prompt}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>{drawer?.displayName.split(' ')[0]} is drawing:</span>
              <span className="font-mono text-[16px] font-bold tracking-widest text-cyan-300">
                {'_ '.repeat(Math.min(r.hintLength, 15))}
              </span>
            </span>
          )}
        </span>
      </div>

      {/* Pictionary Tablet Canvas */}
      <PictionaryCanvas
        gameId={g.id}
        canDraw={isDrawer && g.state === 'active_round'}
        round={g.currentRound}
      />

      {/* Real-Time Guess Stream */}
      <div className="max-h-28 space-y-1 overflow-y-auto rounded-2xl bg-slate-950/60 p-2.5 text-[12px] ring-1 ring-white/5">
        {r.guesses.map((x, i) => (
          <p
            key={i}
            className={cn(
              'rounded-lg px-2 py-0.5',
              x.correct ? 'bg-emerald-500/20 font-bold text-emerald-300' : 'text-slate-300',
            )}
          >
            <span className="font-semibold text-slate-400">
              {g.participants.find((p) => p.userId === x.userId)?.displayName.split(' ')[0]}:
            </span>{' '}
            {x.text}
            {x.correct && ' 🎯 Correct!'}
          </p>
        ))}
      </div>

      {/* Guesser Input Field */}
      {g.state === 'active_round' && !isDrawer && !r.solvedBy.includes(meId) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (guess.trim()) {
              tap();
              void act('guess', { text: guess.trim() });
            }
            setGuess('');
          }}
          className="flex gap-2"
        >
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Type your guess here…"
            className="h-[44px] flex-1 rounded-full bg-slate-800 px-4 text-[15px] text-white outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <Button type="submit" className="btn-arcade rounded-full bg-cyan-500 px-5 font-bold text-slate-950">
            Guess
          </Button>
        </form>
      )}

      {/* Solved celebration badge */}
      {g.state === 'active_round' && !isDrawer && r.solvedBy.includes(meId) && (
        <div className="rounded-xl bg-emerald-500/20 p-2.5 text-center text-[13px] font-bold text-emerald-300 ring-1 ring-emerald-500/40">
          🎯 You solved it! Enjoy watching the others scramble.
        </div>
      )}

      {/* Round Results */}
      {g.state === 'round_results' &&
        (isHost ? (
          <Button
            block
            size="lg"
            onClick={() => {
              tap();
              act('skip');
            }}
            className="btn-arcade bg-gradient-to-r from-cyan-600 to-teal-600 text-white"
          >
            Next Drawer ⚡
          </Button>
        ) : (
          <p className="text-center text-[13px] font-medium text-slate-400">
            The secret answer was “<span className="font-bold text-white">{r.prompt}</span>”.
          </p>
        ))}
    </div>
  );
}
