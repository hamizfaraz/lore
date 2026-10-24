'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `draft_card` card [C1] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function DraftCard({ message }: CardProps<'draft_card'>) {
  return <CardShell title="draft card">{message.body ?? null}</CardShell>;
}
