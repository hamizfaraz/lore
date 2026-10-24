'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `game_result` card [C1] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function GameResultCard({ message }: CardProps<'game_result'>) {
  return <CardShell title="game result">{message.body ?? null}</CardShell>;
}
