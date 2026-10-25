'use client';
import type { GameStateDTO } from '@lore/shared/dto/games';
import { Check, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { AiPill, Chip } from '@/components/ui/Labels';
import { ListRow } from '@/components/ui/ListRow';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { tap } from '@/lib/haptics';
import { useMe } from '@/lib/hooks';
import { toast } from '@/lib/store';
import { PictionaryCanvas } from './PictionaryCanvas';
import { StoryText } from './StoryText';
import { MODE_LABEL, useGame } from './useGame';

type Round<M extends string> = Extract<NonNullable<GameStateDTO['round']>, { mode: M }>;

function Countdown({ deadline }: { deadline: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return null;
  const left = Math.max(0, new Date(deadline).getTime() - now);
  return (
    <span className={cn('tabular-nums text-[14px] font-semibold', left < 5000 ? 'text-heart' : 'text-ink-2')}>
      {Math.ceil(left / 1000)}s
    </span>
  );
}

/** Game screen [C1] (full-screen modal over the chat), section 8.5 / 9.6. */
export function GamePage({ conversationId, gameId }: { conversationId: string; gameId: string }) {
  const router = useRouter();
  const me = useMe();
  const meId = me.data?.user.id ?? '';
  const { game: g, act, join, start } = useGame(gameId);
  const [shareOpen, setShareOpen] = useState(false);
  if (!g) return <div className="fixed inset-0 z-50 bg-bg" />;
  const isHost = g.hostUserId === meId;
  const over = g.state === 'completed' || g.state === 'abandoned';
  const notice = g.round && 'loreNotice' in g.round ? g.round.loreNotice : null;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 z-50 flex flex-col bg-bg md:left-1/2 md:w-[480px] md:-translate-x-1/2 md:border-x md:hairline"
    >
      <header className="chrome flex items-center gap-3 border-b hairline px-3 pb-2 pt-[calc(var(--safe-top)+8px)]">
        <button
          type="button"
          aria-label="Back to chat"
          onClick={() => router.push(`/c/${conversationId}`)}
          className="press"
        >
          <X size={26} />
        </button>
        <div className="flex-1">
          <p className="font-display text-[18px] font-semibold">{MODE_LABEL[g.mode]}</p>
          <p className="text-[12px] text-ink-2">
            {g.state === 'lobby'
              ? 'Lobby'
              : over
                ? g.state === 'completed'
                  ? 'Finished'
                  : 'Ended — nothing was shared'
                : g.mode === 'one_word_story'
                  ? `${(g.round as Round<'one_word_story'>)?.words.length ?? 0} / ${g.config.maxWords} words`
                  : `Round ${g.currentRound} of ${g.mode === 'pictionary' ? g.config.rounds * g.participants.length : g.config.rounds}`}
          </p>
        </div>
        {isHost && !over && (
          <Button size="sm" variant="secondary" onClick={() => act('end')}>
            End
          </Button>
        )}
      </header>

      <div className="flex gap-2 overflow-x-auto px-3 py-2" aria-label="Players">
        {g.participants.map((p) => (
          <span
            key={p.userId}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1 pr-2.5 text-[12px]"
          >
            <span className="rounded-full ring-2" style={{ ['--tw-ring-color' as string]: p.color }}>
              <Avatar src={p.avatarUrl} name={p.displayName} size={22} />
            </span>
            {p.displayName.split(' ')[0]}
            {g.mode !== 'one_word_story' && <b>{p.score}</b>}
          </span>
        ))}
      </div>
      {notice && <p className="mx-3 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-ink-2">{notice}</p>}

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {g.state === 'lobby' && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-[18px] font-semibold">
              {g.participants.length} {g.participants.length === 1 ? 'player' : 'players'} in the lobby
            </p>
            <p className="text-ink-2">
              Prompts from {g.config.contextSource === 'lore' ? 'group lore' : g.config.contextSource} ·{' '}
              {g.config.timerSec}s timer
            </p>
            {!g.youAreIn && (
              <Button size="lg" onClick={join}>
                Join game
              </Button>
            )}
            {isHost ? (
              <Button
                size="lg"
                onClick={start}
                disabled={g.participants.length < (g.mode === 'pictionary' ? 2 : 1)}
              >
                Start
              </Button>
            ) : (
              g.youAreIn && <p className="text-ink-2">Waiting for the host to start…</p>
            )}
          </div>
        )}

        {g.mode === 'one_word_story' && g.round?.mode === 'one_word_story' && g.state !== 'lobby' && (
          <OneWord g={g} r={g.round} meId={meId} act={act} />
        )}
        {g.mode === 'meme_battle' && g.round?.mode === 'meme_battle' && !over && (
          <Meme g={g} r={g.round} meId={meId} isHost={isHost} act={act} />
        )}
        {g.mode === 'pictionary' && g.round?.mode === 'pictionary' && !over && (
          <Pict g={g} r={g.round} meId={meId} isHost={isHost} act={act} />
        )}

        {g.state === 'completed' && g.result && (
          <div className="mt-4 space-y-3">
            {g.result.imageUrl ? (
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={g.result.imageUrl}
                  alt={g.result.title ?? ''}
                  className="aspect-[4/5] w-full object-cover"
                />
                {g.result.imageAiGenerated && (
                  <AiPill className="absolute bottom-3 left-3" label="AI illustration" />
                )}
              </div>
            ) : (
              g.mode !== 'one_word_story' && (
                <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-surface-2 text-[13px] text-ink-2">
                  Generating illustration…
                </div>
              )
            )}
            {g.result.title && <p className="font-display text-[22px] font-semibold">{g.result.title}</p>}
            {g.mode !== 'one_word_story' && g.result.text && <p>{g.result.text}</p>}
            <Button block size="lg" onClick={() => setShareOpen(true)}>
              Share
            </Button>
          </div>
        )}
      </div>

      <Sheet open={shareOpen} onOpenChange={setShareOpen} title="Share result">
        <div className="pb-6">
          <ListRow
            title="Save to chat"
            subtitle="Already posted as a card in the chat"
            chevron={false}
            onClick={() => {
              setShareOpen(false);
              toast('Saved in the chat');
            }}
          />
          <ListRow
            title="Share to my story"
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
                subtitle="Creates a draft for the group to approve"
                onClick={async () => {
                  const r = await act('propose_group', { accountId: a.id });
                  setShareOpen(false);
                  if (r) router.push(`/c/${conversationId}`);
                }}
              />
            ))}
        </div>
      </Sheet>
    </motion.div>
  );
}

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
    <div className="flex min-h-full flex-col">
      <div className="flex-1">
        {r.words.length ? (
          <StoryText words={r.words} participants={g.participants} big />
        ) : (
          <p className="font-display text-[22px] text-ink-2">The story starts with you…</p>
        )}
      </div>
      {g.state === 'active_round' && (
        <div className="sticky bottom-0 space-y-3 bg-bg pb-[calc(var(--safe-bottom)+8px)] pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold">
              {mine
                ? 'Your turn — pick one word'
                : `${active?.displayName.split(' ')[0] ?? 'Someone'} is choosing…`}
            </span>
            <Countdown deadline={r.deadline} />
          </div>
          {mine && (
            <div className="grid grid-cols-2 gap-2">
              <AnimatePresence>
                {r.choices!.map((w, i) => (
                  <motion.button
                    key={w}
                    type="button"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                    disabled={Boolean(picked)}
                    onClick={() => {
                      tap();
                      setPicked(w);
                      void act('choose_word', { word: w });
                    }}
                    className={cn(
                      'press-btn rounded-2xl border-2 py-4 text-[18px] font-semibold',
                      i === 4 && 'col-span-2',
                      picked === w ? 'border-action bg-action text-white' : 'border-line',
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
        <Chip>
          {r.phase === 'submitting'
            ? `${r.submittedCount}/${g.participants.length} submitted`
            : r.phase === 'voting'
              ? `${r.votedCount}/${g.participants.length} voted`
              : 'Results'}
        </Chip>
        <Countdown deadline={r.deadline} />
      </div>
      {r.phase === 'submitting' && (
        <>
          {r.prompt.kind === 'image' ? (
            <>
              {r.prompt.imageUrl ? (
                <img
                  src={r.prompt.imageUrl}
                  alt=""
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="aspect-square w-full animate-pulse rounded-2xl bg-surface-2" />
              )}
              <p className="text-[13px] text-ink-2">Prompt: {r.prompt.text}</p>
              {!r.mySubmitted && (
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={140}
                  rows={2}
                  placeholder="Write your caption…"
                  className="w-full rounded-xl bg-surface-2 p-3 text-[16px] outline-none"
                />
              )}
            </>
          ) : (
            <>
              <p className="font-display text-[20px]">“{r.prompt.text}”</p>
              <div className="grid grid-cols-3 gap-2">
                {(r.prompt.imageOptions ?? []).map((u, i) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setOpt(i)}
                    className={cn(
                      'overflow-hidden rounded-xl border-2',
                      opt === i ? 'border-action' : 'border-transparent',
                    )}
                  >
                    <img src={u} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
                {!r.prompt.imageOptions?.length &&
                  [0, 1, 2].map((i) => (
                    <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface-2" />
                  ))}
              </div>
            </>
          )}
          {r.mySubmitted ? (
            <p className="text-center text-ink-2">Submitted privately. Waiting for others…</p>
          ) : (
            <Button
              block
              size="lg"
              disabled={r.prompt.kind === 'image' && !caption.trim()}
              onClick={() => act('submit_meme', { caption, imageOption: opt })}
            >
              Submit privately
            </Button>
          )}
        </>
      )}
      {r.phase !== 'submitting' && (
        <div className="grid grid-cols-2 gap-3">
          {r.gallery.map((e) => (
            <div
              key={e.slot}
              className={cn(
                'overflow-hidden rounded-2xl border hairline',
                r.myVoteSlot === e.slot && 'ring-2 ring-action',
              )}
            >
              {e.imageUrl && <img src={e.imageUrl} alt="" className="aspect-square w-full object-cover" />}
              <p className="p-2 text-[13px] font-semibold">{e.caption}</p>
              {r.phase === 'voting' ? (
                <button
                  type="button"
                  disabled={r.myVoteSlot !== null || r.mySlot === e.slot}
                  onClick={() => act('vote_meme', { slot: e.slot })}
                  className="w-full border-t hairline py-2 text-[13px] font-semibold text-action disabled:text-ink-2"
                >
                  {r.mySlot === e.slot ? (
                    'Yours'
                  ) : r.myVoteSlot === e.slot ? (
                    <span className="inline-flex items-center gap-1">
                      <Check size={14} /> Voted
                    </span>
                  ) : (
                    'Vote'
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-between border-t hairline px-2 py-1.5 text-[12px]">
                  <span className="flex items-center gap-1">
                    {e.creator?.type === 'ai' ? <AiPill /> : e.creator?.displayName}
                  </span>
                  <b>{e.votes} ❤</b>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {r.phase === 'reveal' && isHost && (
        <Button block size="lg" onClick={() => act('next_round')}>
          {g.currentRound >= g.config.rounds ? 'Finish' : 'Next round'}
        </Button>
      )}
      {r.phase === 'reveal' && !isHost && <p className="text-center text-ink-2">Waiting for the host…</p>}
      {r.phase === 'voting' && (
        <p className="text-center text-[12px] text-ink-2">Entries are anonymous until everyone votes.</p>
      )}
    </div>
  );
}

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
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold">
          {isDrawer ? (
            <>
              Draw: <span className="font-display text-[18px]">{r.prompt}</span>
            </>
          ) : (
            `${drawer?.displayName.split(' ')[0]} is drawing · ${'_ '.repeat(Math.min(r.hintLength, 20))}`
          )}
        </span>
        <Countdown deadline={r.deadline} />
      </div>
      <PictionaryCanvas
        gameId={g.id}
        canDraw={isDrawer && g.state === 'active_round'}
        round={g.currentRound}
      />
      <div className="max-h-32 space-y-1 overflow-y-auto text-[13px]">
        {r.guesses.map((x, i) => (
          <p key={i} className={x.correct ? 'font-semibold text-verified' : ''}>
            {g.participants.find((p) => p.userId === x.userId)?.displayName.split(' ')[0]}: {x.text}
          </p>
        ))}
      </div>
      {g.state === 'active_round' && !isDrawer && !r.solvedBy.includes(meId) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (guess.trim()) void act('guess', { text: guess });
            setGuess('');
          }}
          className="flex gap-2"
        >
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Your guess"
            className="h-11 flex-1 rounded-full bg-surface-2 px-4 text-[16px] outline-none"
          />
          <Button type="submit">Guess</Button>
        </form>
      )}
      {g.state === 'round_results' &&
        (isHost ? (
          <Button block size="lg" onClick={() => act('skip')}>
            Next drawer
          </Button>
        ) : (
          <p className="text-center text-ink-2">The answer was “{r.prompt}”.</p>
        ))}
    </div>
  );
}
