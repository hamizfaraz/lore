'use client';
import { Sheet } from '@/components/ui/Sheet';

/** "Why did Milo say this?" sheet [C2]: shows reason + memory summaries used. Stub from the scaffold. */
export function WhySheet({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  messageId: string;
  reason?: string;
  memoryIds?: string[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Why did Milo say this?">
      <p className="px-5 py-6">{reason ?? 'No reason recorded.'}</p>
    </Sheet>
  );
}
