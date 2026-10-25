'use client';
import { useMe } from '@/lib/hooks';
import { ProfileView } from './ProfileView';

/** Profile tab root [C1] — kept mounted by AppShell. */
export function MyProfileScreen() {
  const me = useMe();
  const handle = me.data?.personalAccount?.handle;
  return handle ? <ProfileView handle={handle} root /> : null;
}
