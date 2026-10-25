'use client';
import { Crown, Share2, Sparkles, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { AiPill } from '@/components/ui/Labels';
import type { CardProps } from '@/features/chat/cards/types';
import { cn } from '@/lib/cn';
import { MODE_LABEL, useGame } from '../useGame';
import { StoryText } from '../StoryText';

/**
 * Commemorative victory and recap card for chat [C1 / Playmode].
 * Highlights AI-illustrated stories, winning memes, and player contributions.
 */
export default function GameResultCard({ message, data, conversationId }: CardProps<'game_result'>) {
  const { game } = useGame(message.cardRefId!);
  const g = game ?? data;
  if (!g?.result) {
    return (
      <div className="h-48 w-[min(320px,84vw)] animate-pulse rounded-2xl border hairline bg-surface-2/60" />
    );
  }

  const r = g.result;
  const winners = g.participants.filter((p) => r.winners.includes(p.userId));

  return (
    <div className="w-[min(330px,85vw)] overflow-hidden rounded-2xl border border-amber-500/30 bg-bg shadow-xl">
      {/* Trophy Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 p-3 text-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/15">
              <Trophy size={16} className="text-slate-900" />
            </span>
            <div>
              <p className="font-display text-[14px] font-bold leading-tight tracking-tight">
                {r.title ?? `${MODE_LABEL[g.mode]} Result`}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-900/70">
                Playmode Highlight
              </p>
            </div>
          </div>
          {r.imageAiGenerated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold text-slate-900 backdrop-blur-md">
              <Sparkles size={10} /> AI Art
            </span>
          )}
        </div>
      </div>

      {/* Hero Showcase (Image if present) */}
      {r.imageUrl && (
        <div className="relative overflow-hidden bg-black">
          <img
            src={r.imageUrl}
            alt={r.title ?? 'Game result artwork'}
            className="aspect-[4/5] w-full object-cover transition-transform duration-300 hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
        </div>
      )}

      {/* Body Content */}
      <div className="space-y-3 p-3.5">
        {g.mode === 'one_word_story' && r.words ? (
          <div className="rounded-xl bg-surface-2/60 p-3">
            <StoryText words={r.words} participants={g.participants} />
          </div>
        ) : (
          r.text && <p className="text-[13px] leading-relaxed text-ink">{r.text}</p>
        )}

        {/* Winners Strip */}
        {winners.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <Crown size={15} className="text-amber-500" />
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {winners.map((w) => (
                    <Avatar key={w.userId} src={w.avatarUrl} name={w.displayName} size={22} />
                  ))}
                </div>
                <span className="text-[12px] font-bold text-amber-600 dark:text-amber-300">
                  {winners.map((w) => w.displayName.split(' ')[0]).join(' & ')}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-amber-500">Winner</span>
          </div>
        )}

        {/* Action Link */}
        <div className="pt-1">
          <Link
            href={`/c/${conversationId}/games/${g.id}`}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 py-2 text-center text-[12px] font-semibold text-ink transition-colors hover:bg-surface-2/80"
          >
            <Share2 size={13} /> Share to Story or Group
          </Link>
        </div>
      </div>
    </div>
  );
}
