'use client';
import type { PersonaExplanationDTO } from '@lore/shared/dto/persona';
import { useQuery } from '@tanstack/react-query';
import { Brain, ShieldCheck } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { api } from '@/lib/api';

/** "Why did Milo say this?" sheet [C2]: shows reason + memory summaries used. Stub from the scaffold. */
export function WhySheet({
  open,
  onOpenChange,
  conversationId,
  messageId,
  reason,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  messageId: string;
  reason?: string;
  memoryIds?: string[];
}) {
  const explanation = useQuery({
    queryKey: ['persona', conversationId, 'explanation', messageId],
    queryFn: () =>
      api.get<PersonaExplanationDTO>(`/v1/conversations/${conversationId}/persona/explanations/${messageId}`),
    enabled: open && Boolean(messageId),
  });
  const resolvedReason = explanation.data?.reason ?? reason;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Why did Milo say this?">
      <div className="space-y-5 px-5 py-6">
        <div className="flex gap-3">
          <ShieldCheck size={21} className="mt-0.5 shrink-0 text-ai" />
          <div>
            <p className="font-semibold">Reason</p>
            <p className="mt-1 text-[14px] text-ink-2">
              {explanation.isLoading
                ? 'Checking the decision log…'
                : (resolvedReason ?? 'No reason recorded.')}
            </p>
          </div>
        </div>
        {explanation.data?.memories.length ? (
          <div>
            <p className="mb-2 flex items-center gap-2 font-semibold">
              <Brain size={18} className="text-ai" /> Memories used
            </p>
            <ul className="space-y-2">
              {explanation.data.memories.map((memory) => (
                <li key={memory.id} className="rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
                  {memory.summary}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-[11px] text-ink-2">
          Private, deleted, expired, and high-sensitivity memories are never shown here.
        </p>
      </div>
    </Sheet>
  );
}
