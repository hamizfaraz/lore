'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Profile [C1] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function ProfilePage(_props: { handle: string; group?: boolean }) {
  return (
    <StackScreen>
      <TopBar title="Profile" back={true} />
      <EmptyState icon={Hammer} title="Profile" body="Coming soon." />
    </StackScreen>
  );
}
