'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `ai_image` card [C2] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function AiImageCard({ message }: CardProps<'ai_image'>) {
  return <CardShell title="ai image">{message.body ?? null}</CardShell>;
}
