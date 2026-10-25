'use client';
import type { GameStateDTO } from '@lore/shared/dto/games';
import { BookOpenText, Brush, Eye, Flame, Gamepad2, Laugh, Sparkles, Trophy, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import type { CardProps } from '@/features/chat/cards/types';
import { cn } from '@/lib/cn';
import { tap } from '@/lib/haptics';
import { MODE_LABEL, useGame } from '../useGame';

const GAME_THEMES = {
  one_word_story: {
    title: 'STORY FORGE',
    subtitle: 'One-Word Story',
    icon: BookOpenText,
    gradient: 'from-violet-600 via-purple-600 to-indigo-700',
    border: 'border-violet-500/30',
    tag: 'Collaborative Story',
  },
  meme_battle: {
    title: 'MEME ROYALE',
    subtitle: 'Meme Battle',
    icon: Laugh,
    gradient: 'from-rose-600 via-pink-600 to-amber-600',
    border: 'border-rose-500/30',
    tag: 'Anonymous Meme Duel',
  },
  pictionary: {
    title: 'DOODLE DUEL',
    subtitle: 'Pictionary',
    icon: Brush,
    gradient: 'from-cyan-600 via-teal-600 to-emerald-600',
    border: 'border-cyan-500/30',
    tag: 'Live Drawing & Guessing',
  },
} as const;

/**
 * High-voltage game cartridge card for chat [C1 / Playmode].
 * Features live status, player color orbits, lore badges, and tactile join actions.
 */
export default function GameInviteCard({ message, data, conversationId }: CardProps<'game_invite'>) {
  const router = useRouter();
  const id = message.cardRefId!;
  const { game, join } = useGame(id);
  const g: GameStateDTO | undefined = game ?? data;
  const [joining, setJoining] = useState(false);

  if (!g) {
    return (
      <div className="h-44 w-[min(320px,84vw)] animate-pulse rounded-2xl border hairline bg-surface-2/60" />
    );
  }

  const theme = GAME_THEMES[g.mode] ?? {
    title: MODE_LABEL[g.mode] ?? 'LORE GAME',
    subtitle: 'Party Game',
    icon: Gamepad2,
    gradient: 'from-blue-600 to-indigo-600',
    border: 'border-blue-500/30',
    tag: 'Party Game',
  };

  const Icon = theme.icon;
  const over = g.state === 'completed' || g.state === 'abandoned';
  const isLobby = g.state === 'lobby';
  const open = () => {
    tap();
    router.push(`/c/${conversationId}/games/${id}`);
  };

  const handleJoin = async () => {
    setJoining(true);
    tap();
    await join();
    setJoining(false);
    open();
  };

  return (
    <div
      className={cn(
        'w-[min(330px,85vw)] overflow-hidden rounded-2xl border bg-bg shadow-lg transition-all',
        theme.border,
      )}
    >
      {/* Game Cartridge Header */}
      <div className={cn('relative overflow-hidden bg-gradient-to-r p-3.5 text-white', theme.gradient)}>
        <div className="absolute -right-4 -top-4 opacity-15">
          <Icon size={96} />
        </div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/25 backdrop-blur-md">
              <Icon size={18} className="text-white" />
            </span>
            <div>
              <p className="font-display text-[15px] font-bold tracking-tight text-white drop-shadow-sm">
                {theme.title}
              </p>
              <p className="text-[11px] font-medium text-white/80">{theme.subtitle}</p>
            </div>
          </div>

          {/* Live Status Pill */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide backdrop-blur-md',
              isLobby && 'bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/40',
              !isLobby && !over && 'bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/40',
              over && 'bg-white/20 text-white/90',
            )}
          >
            {isLobby && <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />}
            {!isLobby && !over && <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
            {over ? (
              <>
                <Trophy size={11} /> Finished
              </>
            ) : isLobby ? (
              'Lobby open'
            ) : (
              'Round active'
            )}
          </span>
        </div>
      </div>

      {/* Body Section */}
      <div className="space-y-3 p-3.5">
        {/* Lore / Inside Joke Callout */}
        {g.config.contextSource === 'lore' ? (
          <div className="flex items-center gap-1.5 rounded-xl bg-purple-500/10 px-2.5 py-1.5 text-[11px] font-medium text-purple-600 dark:text-purple-300">
            <Sparkles size={13} className="shrink-0 text-purple-500" />
            <span className="truncate">Infused with chat lore & inside jokes</span>
          </div>
        ) : g.config.aiCompetitor && g.mode === 'meme_battle' ? (
          <div className="flex items-center gap-1.5 rounded-xl bg-pink-500/10 px-2.5 py-1.5 text-[11px] font-medium text-pink-600 dark:text-pink-300">
            <Flame size={13} className="shrink-0 text-pink-500" />
            <span>Milo the AI is competing in this match</span>
          </div>
        ) : null}

        {/* Player Roster Preview */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {g.participants.slice(0, 5).map((p) => (
                <span
                  key={p.userId}
                  className="rounded-full ring-2"
                  style={{ ['--tw-ring-color' as string]: p.color || '#3b82f6' }}
                >
                  <Avatar src={p.avatarUrl} name={p.displayName} size={26} />
                </span>
              ))}
            </div>
            {g.participants.length > 5 && (
              <span className="text-[12px] font-semibold text-ink-2">+{g.participants.length - 5}</span>
            )}
          </div>
          <span className="flex items-center gap-1 text-[12px] font-medium text-ink-2">
            <Users size={13} />
            {g.participants.length} {g.participants.length === 1 ? 'player' : 'players'}
          </span>
        </div>

        {/* Quick Config Specs */}
        <div className="flex items-center gap-3 border-t hairline pt-2 text-[11px] text-ink-2">
          <span>{g.config.timerSec}s timer</span>
          <span>•</span>
          <span>
            {g.mode === 'one_word_story' ? `${g.config.maxWords} words goal` : `${g.config.rounds} rounds`}
          </span>
          {g.config.teams && (
            <>
              <span>•</span>
              <span className="text-action">Teams active</span>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-1">
          {over ? (
            <Button block size="md" variant="secondary" onClick={open} className="gap-1.5">
              <Trophy size={15} /> View Recap & Winners
            </Button>
          ) : !g.youAreIn ? (
            <div className="flex gap-2">
              <Button
                block
                size="md"
                onClick={handleJoin}
                disabled={joining}
                className="flex-1 gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md"
              >
                <Gamepad2 size={16} /> {isLobby ? 'Join Game' : 'Jump In'}
              </Button>
              {!isLobby && (
                <Button size="md" variant="secondary" onClick={open} className="px-3" title="Spectate">
                  <Eye size={16} />
                </Button>
              )}
            </div>
          ) : (
            <Button
              block
              size="md"
              onClick={open}
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
            >
              <Gamepad2 size={16} /> Enter Arena
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
