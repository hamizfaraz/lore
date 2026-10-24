'use client';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

/** `plan_confirmed` card [C2] — stub from the C1-0b scaffold. The owner replaces this file's contents. */
export default function PlanConfirmedCard({ message }: CardProps<'plan_confirmed'>) {
  return <CardShell title="plan confirmed">{message.body ?? null}</CardShell>;
}
