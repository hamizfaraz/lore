'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Camera [C1] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function StoryCameraPage(_props: {}) {
  return (
    <StackScreen>
      <TopBar title="Camera" back={true} />
      <EmptyState icon={Hammer} title="Camera" body="Coming soon." />
    </StackScreen>
  );
}
