'use client';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Bot, Facebook, Lock, LogOut, Moon, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Toggle } from '@/components/ui/Field';
import { ListRow, SectionHeader } from '@/components/ui/ListRow';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/hooks';
import { enablePush } from '@/lib/push';
import { qk } from '@/lib/query-keys';
import { disconnectSocket } from '@/lib/socket';
import { toast } from '@/lib/store';
import { type ThemePref, applyTheme, getTheme } from '@/lib/theme';

/** Instagram-style settings list [C1]: account, theme, connections (Facebook), privacy, notifications. */
export function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const [theme, setTheme] = useState<ThemePref>('system');
  useEffect(() => setTheme(getTheme()), []);
  const acct = me.data?.personalAccount;
  const isPrivate = acct?.visibility === 'private';

  const setPrivate = async (v: boolean) => {
    await api.patch('/v1/me/profile', { visibility: v ? 'private' : 'public' });
    qc.invalidateQueries({ queryKey: qk.me });
  };

  return (
    <StackScreen>
      <TopBar title="Settings and activity" back />
      <div className="mx-auto w-full max-w-[600px] pb-10">
        <SectionHeader>Your account</SectionHeader>
        <ListRow
          icon={<UserRound size={22} />}
          title="Edit profile"
          subtitle={acct ? `@${acct.handle}` : undefined}
          href={acct ? `/u/${acct.handle}` : undefined}
        />
        <SectionHeader>How you use LORE</SectionHeader>
        <ListRow
          icon={<Bell size={22} />}
          title="Notifications"
          subtitle="Approvals, plans and messages on your lock screen"
          onClick={async () => toast(await enablePush())}
        />
        <div className="flex items-center gap-3 px-4 py-2">
          <Moon size={22} className="w-7" />
          <span className="flex-1 text-[15px]">Theme</span>
          <div className="flex rounded-lg bg-surface-2 p-0.5 text-[13px] font-semibold">
            {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTheme(t);
                  applyTheme(t);
                }}
                className={cn('rounded-md px-3 py-1 capitalize', theme === t && 'bg-bg shadow-sm')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <SectionHeader>Who can see your content</SectionHeader>
        <div className="flex items-center gap-3 px-4 py-2">
          <Lock size={22} className="w-7" />
          <span className="flex-1 text-[15px]">Private account</span>
          <Toggle checked={isPrivate} onChange={setPrivate} label="Private account" />
        </div>
        <SectionHeader>Connections</SectionHeader>
        <ListRow
          icon={<Facebook size={22} />}
          title="Facebook"
          subtitle={me.data?.facebookLinked ? 'Connected' : 'Not connected'}
          href="/settings?section=facebook"
        />
        <ListRow
          icon={<Bot size={22} />}
          title="Connect Muse"
          subtitle="Use LORE from the Muse app"
          href="/settings/muse"
        />
        <SectionHeader>Login</SectionHeader>
        <ListRow
          icon={<LogOut size={22} />}
          danger
          title={`Log out ${acct?.handle ?? ''}`}
          onClick={async () => {
            await authClient.signOut();
            disconnectSocket();
            qc.clear();
            router.replace('/login');
          }}
        />
      </div>
    </StackScreen>
  );
}
