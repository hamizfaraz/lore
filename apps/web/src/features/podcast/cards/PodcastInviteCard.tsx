'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `podcast_invite` card [C2] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function PodcastInviteCard({ message }: CardProps<'podcast_invite'>) {
  return <CardShell title="podcast invite">{message.body ?? null}</CardShell>;
}
