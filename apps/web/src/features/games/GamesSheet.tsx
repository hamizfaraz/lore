'use client';
import type { GameStateDTO } from '@lore/shared/dto/games';
import type { ContextSource, GameMode } from '@lore/shared/enums';
import { BookOpenText, Bot, Brush, Clock, Flame, Gamepad2, Laugh, Sparkles, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { clientFlags } from '@/lib/flags';
import { tap } from '@/lib/haptics';
import { toast } from '@/lib/store';

interface GameModeOption {
  mode: GameMode;
  title: string;
  badge: string;
  body: string;
  icon: typeof BookOpenText;
  accent: string;
  borderActive: string;
  gradient: string;
  on: boolean;
}

const MODES: GameModeOption[] = [
  {
    mode: 'one_word_story',
    title: 'Story Forge',
    badge: '1-Word Story',
    body: 'Collaboratively forge chaotic sentences 1 word at a time. Milo AI paints the ending!',
    icon: BookOpenText,
    accent: 'text-violet-500',
    borderActive: 'border-violet-500 shadow-violet-500/20 shadow-lg',
    gradient: 'from-violet-600/20 to-indigo-600/10',
    on: true,
  },
  {
    mode: 'meme_battle',
    title: 'Meme Royale',
    badge: 'Meme Duel',
    body: 'Caption prompts or pick images, vote anonymously, with Milo competing too!',
    icon: Laugh,
    accent: 'text-rose-500',
    borderActive: 'border-rose-500 shadow-rose-500/20 shadow-lg',
    gradient: 'from-rose-600/20 to-amber-600/10',
    on: clientFlags.gamesMeme,
  },
  {
    mode: 'pictionary',
    title: 'Doodle Duel',
    badge: 'Pictionary',
    body: 'Draw secret prompts or inside jokes on a live canvas while the group guesses.',
    icon: Brush,
    accent: 'text-cyan-500',
    borderActive: 'border-cyan-500 shadow-cyan-500/20 shadow-lg',
    gradient: 'from-cyan-600/20 to-teal-600/10',
    on: clientFlags.gamesPictionary,
  },
];

/**
 * Playmode Game Launcher Sheet [C1 / Section 8.5].
 * High-energy selection with tactile configuration sliders, lore toggles, and AI competitors.
 */
export function GamesSheet({
  open,
  onOpenChange,
  conversationId,
}: { open: boolean; onOpenChange: (v: boolean) => void; conversationId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<GameMode>('one_word_story');
  const [rounds, setRounds] = useState(3);
  const [timerSec, setTimer] = useState(20);
  const [maxWords, setMaxWords] = useState(24);
  const [ctx, setCtx] = useState<ContextSource>('lore');
  const [teams, setTeams] = useState(false);
  const [aiCompetitor, setAi] = useState(true);
  const [busy, setBusy] = useState(false);

  const launch = async () => {
    setBusy(true);
    tap();
    try {
      const g = await api.post<GameStateDTO>('/v1/games', {
        conversationId,
        mode,
        config: { rounds, timerSec, maxWords, contextSource: ctx, teams, aiCompetitor },
      });
      onOpenChange(false);
      router.push(`/c/${conversationId}/games/${g.id}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const stepper = (
    label: string,
    v: number,
    set: (n: number) => void,
    min: number,
    max: number,
    step = 1,
    unit = '',
  ) => (
    <div className="flex items-center justify-between rounded-xl bg-surface-2/50 px-3 py-2.5">
      <span className="text-[14px] font-medium text-ink">{label}</span>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-[18px] font-bold text-ink active:scale-95"
          onClick={() => {
            tap();
            set(Math.max(min, v - step));
          }}
        >
          −
        </button>
        <span className="w-12 text-center text-[15px] font-bold tabular-nums text-ink">
          {v}
          {unit}
        </span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-[18px] font-bold text-ink active:scale-95"
          onClick={() => {
            tap();
            set(Math.min(max, v + step));
          }}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Launch Playmode" snap="full">
      <div className="space-y-4 p-4 pb-8">
        {/* Banner Pill */}
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-violet-600/15 via-rose-600/15 to-amber-600/15 p-3 ring-1 ring-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md">
              <Gamepad2 size={20} />
            </span>
            <div>
              <p className="font-display text-[15px] font-bold tracking-tight">Party Game Mode</p>
              <p className="text-[12px] text-ink-2">Pick a game to play live with the group</p>
            </div>
          </div>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-action">
            ⚡ Live
          </span>
        </div>

        {/* Game Mode Cards */}
        <div className="space-y-2.5">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-2">Select Game</p>
          {MODES.filter((m) => m.on).map((m) => {
            const isSelected = mode === m.mode;
            const Icon = m.icon;
            return (
              <button
                key={m.mode}
                type="button"
                onClick={() => {
                  tap();
                  setMode(m.mode);
                }}
                className={cn(
                  'relative flex w-full items-start gap-3.5 rounded-2xl border p-3.5 text-left transition-all',
                  isSelected
                    ? cn('border-2 bg-gradient-to-br', m.borderActive, m.gradient)
                    : 'border-line bg-surface-2/30 hover:bg-surface-2/60',
                )}
              >
                <span
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
                    isSelected ? 'bg-ink text-bg shadow-sm' : 'bg-surface-2 text-ink',
                  )}
                >
                  <Icon size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[16px] font-bold text-ink">{m.title}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        isSelected ? 'bg-ink/10 text-ink' : 'bg-surface-2 text-ink-2',
                      )}
                    >
                      {m.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{m.body}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Settings & Modifiers */}
        <div className="space-y-2.5 pt-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-2">Game Rules</p>

          {mode === 'one_word_story'
            ? stepper('Story Length', maxWords, setMaxWords, 12, 60, 4, 'w')
            : stepper('Rounds', rounds, setRounds, 1, 10, 1, 'r')}

          {stepper('Timer per Turn', timerSec, setTimer, 10, 60, 5, 's')}

          {/* Context Source Selector */}
          <div className="space-y-1.5 rounded-xl bg-surface-2/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-ink">Prompt Sources</span>
              <span className="text-[11px] font-semibold text-action">
                {ctx === 'lore' ? '✨ Group Lore' : ctx === 'hybrid' ? '⚡ Hybrid' : '🎲 Random'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(
                [
                  { id: 'lore', label: 'Group Lore', icon: Sparkles },
                  { id: 'hybrid', label: 'Hybrid', icon: Flame },
                  { id: 'random', label: 'Random', icon: Gamepad2 },
                ] as const
              ).map((c) => {
                const active = ctx === c.id;
                const ChipIcon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      tap();
                      setCtx(c.id);
                    }}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition-all',
                      active ? 'bg-ink text-bg shadow-sm' : 'bg-surface-2 text-ink-2 hover:text-ink',
                    )}
                  >
                    <ChipIcon size={13} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode-specific toggles */}
          {mode === 'pictionary' && (
            <div className="flex items-center justify-between rounded-xl bg-surface-2/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-cyan-500" />
                <span className="text-[14px] font-medium text-ink">Team vs Team</span>
              </div>
              <Toggle checked={teams} onChange={setTeams} label="Teams" />
            </div>
          )}

          {mode === 'meme_battle' && (
            <div className="flex items-center justify-between rounded-xl bg-surface-2/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-rose-500" />
                <div>
                  <span className="text-[14px] font-medium text-ink">AI Competitor (Milo)</span>
                  <p className="text-[11px] text-ink-2">Milo plays and submits memes too</p>
                </div>
              </div>
              <Toggle checked={aiCompetitor} onChange={setAi} label="AI Competitor" />
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            block
            size="lg"
            loading={busy}
            onClick={launch}
            className="btn-arcade gap-2 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-xl"
          >
            <Gamepad2 size={18} /> Open Lobby
          </Button>
          <p className="mt-2 text-center text-[12px] text-ink-2">
            A party invite card will drop directly into this chat.
          </p>
        </div>
      </div>
    </Sheet>
  );
}
