'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Sign up [C1] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function SignupPage(_props: {}) {
  return (
    <StackScreen>
      <TopBar title="Sign up" back={true} />
      <EmptyState icon={Hammer} title="Sign up" body="Coming soon." />
    </StackScreen>
  );
}
