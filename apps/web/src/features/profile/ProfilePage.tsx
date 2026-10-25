'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { ProfileView } from './ProfileView';

/** /u/[handle] and /g/[handle] [C1]. Group profiles share the component (section 8.1 step 8). */
export function ProfilePage({ handle }: { handle: string; group?: boolean }) {
  return (
    <StackScreen>
      <ProfileView handle={decodeURIComponent(handle)} />
    </StackScreen>
  );
}
