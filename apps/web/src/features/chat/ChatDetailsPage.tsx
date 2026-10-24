'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Details [C1] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function ChatDetailsPage(_props: { id: string }) {
  return (
    <StackScreen>
      <TopBar title="Details" back={true} />
      <EmptyState icon={Hammer} title="Details" body="Coming soon." />
    </StackScreen>
  );
}
