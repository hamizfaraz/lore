'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Connection Impact [C2] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function ImpactPage(_props: {}) {
  return (
    <StackScreen>
      <TopBar title="Connection Impact" back={true} />
      <EmptyState icon={Hammer} title="Connection Impact" body="Coming soon." />
    </StackScreen>
  );
}
