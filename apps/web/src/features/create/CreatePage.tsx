'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** New post [C1] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function CreatePage(_props: {}) {
  return (
    <StackScreen>
      <TopBar title="New post" back={true} />
      <EmptyState icon={Hammer} title="New post" body="Coming soon." />
    </StackScreen>
  );
}
