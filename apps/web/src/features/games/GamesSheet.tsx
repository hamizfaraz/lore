'use client';
import type { GameStateDTO } from '@lore/shared/dto/games';
import type { ContextSource, GameMode } from '@lore/shared/enums';
import { BookOpenText, Brush, Laugh } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { clientFlags } from '@/lib/flags';
import { toast } from '@/lib/store';

const MODES: { mode: GameMode; title: string; body: string; icon: typeof BookOpenText; on: boolean }[] = [
  {
    mode: 'one_word_story',
    title: 'One-Word Story',
    body: 'Take turns picking one of five words. Milo illustrates the ending.',
    icon: BookOpenText,
    on: true,
  },
  {
    mode: 'meme_battle',
    title: 'Meme Battle',
    body: 'Caption the prompt, vote anonymously, AI plays too.',
    icon: Laugh,
    on: clientFlags.gamesMeme,
  },
  {
    mode: 'pictionary',
    title: 'Pictionary',
    body: 'Draw the secret prompt; everyone else guesses.',
    icon: Brush,
    on: clientFlags.gamesPictionary,
  },
];

/** Launch sheet slides over the chat (section 8.5): mode, rounds, timer, context source, teams, AI competitor. */
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
  const [ctx, setCtx] = useState<ContextSource>('hybrid');
  const [teams, setTeams] = useState(false);
  const [aiCompetitor, setAi] = useState(true);
  const [busy, setBusy] = useState(false);
  const launch = async () => {
    setBusy(true);
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
  ) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-[15px]">{label}</span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          className="h-8 w-8 rounded-full bg-surface-2"
          onClick={() => set(Math.max(min, v - step))}
        >
          −
        </button>
        <span className="w-8 text-center font-semibold tabular-nums">{v}</span>
        <button
          type="button"
          className="h-8 w-8 rounded-full bg-surface-2"
          onClick={() => set(Math.min(max, v + step))}
        >
          +
        </button>
      </span>
    </div>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Play a game" snap="full">
      <div className="space-y-2 p-4">
        {MODES.filter((m) => m.on).map((m) => (
          <button
            key={m.mode}
            type="button"
            onClick={() => setMode(m.mode)}
            className={cn(
              'press flex w-full items-center gap-3 rounded-xl border p-3 text-left',
              mode === m.mode ? 'border-ink' : 'border-line',
            )}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2">
              <m.icon size={22} />
            </span>
            <span>
              <span className="block font-semibold">{m.title}</span>
              <span className="block text-[13px] text-ink-2">{m.body}</span>
            </span>
          </button>
        ))}
        <div className="pt-2">
          {mode === 'one_word_story'
            ? stepper('Story length (words)', maxWords, setMaxWords, 6, 60, 2)
            : stepper('Rounds', rounds, setRounds, 1, 10)}
          {stepper('Timer (seconds)', timerSec, setTimer, 10, 90, 5)}
          <div className="flex items-center justify-between py-2">
            <span className="text-[15px]">Prompts from</span>
            <div className="flex rounded-lg bg-surface-2 p-0.5 text-[13px] font-semibold">
              {(['lore', 'hybrid', 'random'] as ContextSource[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCtx(c)}
                  className={cn('rounded-md px-2.5 py-1 capitalize', ctx === c && 'bg-bg shadow-sm')}
                >
                  {c === 'lore' ? 'Group lore' : c}
                </button>
              ))}
            </div>
          </div>
          {mode === 'pictionary' && (
            <div className="flex items-center justify-between py-2">
              <span className="text-[15px]">Teams</span>
              <Toggle checked={teams} onChange={setTeams} label="Teams" />
            </div>
          )}
          {mode === 'meme_battle' && (
            <div className="flex items-center justify-between py-2">
              <span className="text-[15px]">AI competitor</span>
              <Toggle checked={aiCompetitor} onChange={setAi} label="AI competitor" />
            </div>
          )}
        </div>
        <Button block size="lg" loading={busy} onClick={launch}>
          Open lobby
        </Button>
        <p className="text-center text-[12px] text-ink-2">
          Nobody is auto-enrolled; friends tap Join on the invite.
        </p>
      </div>
    </Sheet>
  );
}
