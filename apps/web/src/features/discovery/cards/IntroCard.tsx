'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `intro_card` card [C2] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function IntroCard({ message }: CardProps<'intro_card'>) {
  return <CardShell title="intro card">{message.body ?? null}</CardShell>;
}
