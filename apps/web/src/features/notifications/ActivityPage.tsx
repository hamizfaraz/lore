'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Notifications [C1] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function ActivityPage(_props: {}) {
  return (
    <StackScreen>
      <TopBar title="Notifications" back={true} />
      <EmptyState icon={Hammer} title="Notifications" body="Coming soon." />
    </StackScreen>
  );
}
