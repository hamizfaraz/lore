'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Game [C1] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function GamePage(_props: { conversationId: string; gameId: string }) {
  return (
    <StackScreen>
      <TopBar title="Game" back={true} />
      <EmptyState icon={Hammer} title="Game" body="Coming soon." />
    </StackScreen>
  );
}
