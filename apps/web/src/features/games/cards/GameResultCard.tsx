'use client';
import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { CardShell } from '@/components/ui/CardShell';
import { AiPill } from '@/components/ui/Labels';
import type { CardProps } from '@/features/chat/cards/types';
import { MODE_LABEL, useGame } from '../useGame';
import { StoryText } from '../StoryText';

/** `game_result` card [C1]: the full story with each word tinted by its author, or winners. */
export default function GameResultCard({ message, data, conversationId }: CardProps<'game_result'>) {
  const { game } = useGame(message.cardRefId!);
  const g = game ?? data;
  if (!g?.result) return <div className="h-40 w-[280px] animate-pulse rounded-2xl bg-surface-2" />;
  const r = g.result;
  const winners = g.participants
    .filter((p) => r.winners.includes(p.userId))
    .map((p) => p.displayName.split(' ')[0]);
  return (
    <CardShell
      icon={<Trophy size={20} />}
      title={r.title ?? MODE_LABEL[g.mode]}
      labels={r.imageAiGenerated ? <AiPill label="AI illustration" /> : undefined}
    >
      {r.imageUrl && (
        <img
          src={r.imageUrl}
          alt={r.title ?? ''}
          className="mb-2 aspect-[4/5] w-full rounded-lg object-cover"
        />
      )}
      {g.mode === 'one_word_story' && r.words ? (
        <StoryText words={r.words} participants={g.participants} />
      ) : (
        r.text && <p className="text-[14px]">{r.text}</p>
      )}
      {winners.length > 0 && <p className="mt-2 text-[13px] font-semibold">🏆 {winners.join(' & ')}</p>}
      <Link
        href={`/c/${conversationId}/games/${g.id}`}
        className="mt-2 block text-[13px] font-semibold text-action"
      >
        Share or propose to the group account
      </Link>
    </CardShell>
  );
}
