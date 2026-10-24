'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Memories [C2] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function MemoriesPage(_props: { conversationId: string }) {
  return (
    <StackScreen>
      <TopBar title="Memories" back={true} />
      <EmptyState icon={Hammer} title="Memories" body="Coming soon." />
    </StackScreen>
  );
}
