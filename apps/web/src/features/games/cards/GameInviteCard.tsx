'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `game_invite` card [C1] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function GameInviteCard({ message }: CardProps<'game_invite'>) {
  return <CardShell title="game invite">{message.body ?? null}</CardShell>;
}
