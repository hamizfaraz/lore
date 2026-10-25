'use client';
import type { GameStateDTO } from '@lore/shared/dto/games';
import { Dices } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AvatarRow } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CardShell } from '@/components/ui/CardShell';
import { Chip } from '@/components/ui/Labels';
import type { CardProps } from '@/features/chat/cards/types';
import { MODE_LABEL, useGame } from '../useGame';

/** `game_invite` card [C1]: lobby status, players, Join / Open. Games launch without leaving the chat. */
export default function GameInviteCard({ message, data, conversationId }: CardProps<'game_invite'>) {
  const router = useRouter();
  const id = message.cardRefId!;
  const { game, join } = useGame(id);
  const g: GameStateDTO | undefined = game ?? data;
  if (!g) return <div className="h-32 w-[280px] animate-pulse rounded-2xl bg-surface-2" />;
  const open = () => router.push(`/c/${conversationId}/games/${id}`);
  const over = g.state === 'completed' || g.state === 'abandoned';
  return (
    <CardShell
      icon={<Dices size={20} />}
      title={MODE_LABEL[g.mode]}
      labels={
        <Chip>
          {g.state === 'lobby'
            ? 'Lobby open'
            : over
              ? g.state === 'completed'
                ? 'Finished'
                : 'Ended'
              : 'In progress'}
        </Chip>
      }
    >
      <div className="flex items-center gap-2">
        <AvatarRow items={g.participants.map((p) => ({ src: p.avatarUrl, name: p.displayName }))} />
        <span className="text-[13px] text-ink-2">{g.participants.length} playing</span>
      </div>
      {!over && (
        <div className="mt-3 flex gap-2">
          {!g.youAreIn ? (
            <Button
              size="sm"
              className="flex-1"
              onClick={async () => {
                await join();
                open();
              }}
            >
              Join
            </Button>
          ) : (
            <Button size="sm" className="flex-1" onClick={open}>
              Open
            </Button>
          )}
        </div>
      )}
    </CardShell>
  );
}
