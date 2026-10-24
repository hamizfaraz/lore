'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell } from '@/components/ui/AppShell';
import { ExploreScreen } from '@/features/explore/ExploreScreen';
import { HomeScreen } from '@/features/feed/HomeScreen';
import { MyProfileScreen } from '@/features/profile/MyProfileScreen';
import { ReelsScreen } from '@/features/reels/ReelsScreen';
import { ApiError } from '@/lib/api';
import { clientFlags } from '@/lib/flags';
import { useMe } from '@/lib/hooks';

/** Signed-in app shell [C1]: tab roots stay mounted; route children are pushed screens (section 9.3). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/login');
    else if (me.data && !me.data.onboarded) router.replace('/onboarding');
  }, [me.error, me.data, router]);

  if (!me.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="wordmark text-ink-2">lore</span>
      </div>
    );
  }
  const acct = me.data.personalAccount;
  return (
    <AppShell
      me={acct ? { handle: acct.handle, avatarUrl: acct.avatarUrl, displayName: acct.displayName } : null}
      profileDot={me.data.pendingApprovals > 0}
      roots={{
        home: <HomeScreen />,
        explore: <ExploreScreen />,
        ...(clientFlags.reels ? { reels: <ReelsScreen /> } : {}),
        profile: <MyProfileScreen />,
      }}
    >
      {children}
    </AppShell>
  );
}
