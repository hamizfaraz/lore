'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `plan_card` card [C2] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function PlanCard({ message }: CardProps<'plan_card'>) {
  return <CardShell title="plan card">{message.body ?? null}</CardShell>;
}
