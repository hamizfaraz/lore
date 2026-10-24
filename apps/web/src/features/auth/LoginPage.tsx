'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Log in [C1] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function LoginPage(_props: {}) {
  return (
    <StackScreen>
      <TopBar title="Log in" back={true} />
      <EmptyState icon={Hammer} title="Log in" body="Coming soon." />
    </StackScreen>
  );
}
