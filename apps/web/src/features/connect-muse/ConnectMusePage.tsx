'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Connect Muse [C2] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function ConnectMusePage(_props: {}) {
  return (
    <StackScreen>
      <TopBar title="Connect Muse" back={true} />
      <EmptyState icon={Hammer} title="Connect Muse" body="Coming soon." />
    </StackScreen>
  );
}
