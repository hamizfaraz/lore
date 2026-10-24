'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Recap [C2] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function RecapEditorPage(_props: { id: string }) {
  return (
    <StackScreen>
      <TopBar title="Recap" back={true} />
      <EmptyState icon={Hammer} title="Recap" body="Coming soon." />
    </StackScreen>
  );
}
