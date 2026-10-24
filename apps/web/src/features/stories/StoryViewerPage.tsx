'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Story [C1] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function StoryViewerPage(_props: { accountId: string }) {
  return (
    <StackScreen>
      <TopBar title="Story" back={true} />
      <EmptyState icon={Hammer} title="Story" body="Coming soon." />
    </StackScreen>
  );
}
