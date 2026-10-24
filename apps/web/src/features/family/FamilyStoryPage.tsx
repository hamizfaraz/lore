'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Family story [C2] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function FamilyStoryPage(_props: { id: string }) {
  return (
    <StackScreen>
      <TopBar title="Family story" back={true} />
      <EmptyState icon={Hammer} title="Family story" body="Coming soon." />
    </StackScreen>
  );
}
