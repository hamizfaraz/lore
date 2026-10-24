'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** AI member [C2] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function AiStudioPage(_props: { conversationId: string }) {
  return (
    <StackScreen>
      <TopBar title="AI member" back={true} />
      <EmptyState icon={Hammer} title="AI member" body="Coming soon." />
    </StackScreen>
  );
}
