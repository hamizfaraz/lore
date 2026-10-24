'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `family_story_card` card [C2] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function FamilyStoryCard({ message }: CardProps<'family_story_card'>) {
  return <CardShell title="family story card">{message.body ?? null}</CardShell>;
}
