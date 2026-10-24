'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Settings [C1] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function ChatSettingsPage(_props: { id: string }) {
  return (
    <StackScreen>
      <TopBar title="Settings" back={true} />
      <EmptyState icon={Hammer} title="Settings" body="Coming soon." />
    </StackScreen>
  );
}
