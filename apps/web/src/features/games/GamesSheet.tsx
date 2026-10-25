'use client';
import { Sheet } from '@/components/ui/Sheet';

/** Game launcher sheet [C1] — filled in C1-7 (One-Word Story), C1-8 (Meme Battle), C1-11 (Pictionary). */
export function GamesSheet({
  open,
  onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void; conversationId: string }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Games">
      <p className="px-5 py-8 text-center text-ink-2">Games are coming soon.</p>
    </Sheet>
  );
}
