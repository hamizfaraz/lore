'use client';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { ListRow } from '@/components/ui/ListRow';

/** "AI member (Milo)" section in Chat Details [C2]. Stub from the scaffold. */
export function AiMemberPanel({
  conversationId,
  persona,
}: { conversationId: string; persona: { id: string; name: string; enabled: boolean } | null }) {
  return (
    <ListRow
      icon={<Sparkles size={22} className="text-ai" />}
      title={persona ? `AI member (${persona.name})` : 'Add an AI member'}
      subtitle={persona && !persona.enabled ? 'Paused' : undefined}
      href={`/c/${conversationId}/ai`}
    />
  );
}
