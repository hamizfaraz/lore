'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `post_share` card [C1] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function PostShareCard({ message }: CardProps<'post_share'>) {
  return <CardShell title="post share">{message.body ?? null}</CardShell>;
}
