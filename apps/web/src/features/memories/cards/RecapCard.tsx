'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `recap_card` card [C2] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function RecapCard({ message }: CardProps<'recap_card'>) {
  return <CardShell title="recap card">{message.body ?? null}</CardShell>;
}
