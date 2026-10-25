'use client';
import { Clapperboard, Compass, Heart, Home, MessageCircle, PlusSquare, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { TabKey } from '@/lib/store';
import { useUi } from '@/lib/store';
import { Avatar } from './Avatar';

export type TabDef = { key: TabKey; href: string; label: string };

/**
 * 5 icons, no labels: Home, Search, Create, Reels, Profile (your avatar, ringed when active).
 * Active = filled icon; tapping the active tab scrolls to top, a second tap pops to root (section 9.2).
 * On desktop (md+) renders Instagram's left icon rail with labels (section 9.3, P1).
 */
export function TabBar({
  tabs,
  active,
  avatarUrl,
  name,
  profileDot,
  onReselect,
  unreadDms,
  unreadNotes,
}: {
  tabs: TabDef[];
  active: TabKey | null;
  avatarUrl?: string | null;
  name?: string;
  profileDot?: boolean;
  onReselect: (k: TabKey) => void;
  unreadDms?: number;
  unreadNotes?: number;
}) {
  const lastPath = useUi((s) => s.lastPathByTab);
  const pathname = usePathname();
  const router = useRouter();
  const icon = (k: TabKey, on: boolean) => {
    const p = { size: 26, strokeWidth: on ? 2.4 : 1.75 };
    switch (k) {
      case 'home':
        return <Home {...p} fill={on ? 'currentColor' : 'none'} />;
      case 'explore':
        return <Search {...p} />;
      case 'create':
        return <PlusSquare {...p} />;
      case 'reels':
        return (
          <Clapperboard
            {...p}
            fill={on ? 'currentColor' : 'none'}
            className={on ? '[&>path]:stroke-bg' : ''}
          />
        );
      case 'profile':
        return (
          <span className={cn('relative rounded-full p-[1.5px]', on && 'ring-2 ring-ink')}>
            <Avatar src={avatarUrl} name={name} size={24} />
            {profileDot && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-heart ring-2 ring-bg">
                <span className="sr-only">Needs your approval</span>
              </span>
            )}
          </span>
        );
    }
  };
  const go = (t: TabDef, e: React.MouseEvent) => {
    e.preventDefault();
    if (active === t.key) {
      onReselect(t.key);
      if (pathname !== t.href) router.push(t.href);
      return;
    }
    router.push(t.key === 'create' ? t.href : (lastPath[t.key] ?? t.href));
  };
  return (
    <>
      <nav
        className="chrome fixed inset-x-0 bottom-0 z-40 border-t hairline bg-bg pb-safe md:hidden"
        aria-label="Tabs"
      >
        <div className="flex h-[49px] items-center justify-around">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              onClick={(e) => go(t, e)}
              aria-label={t.label}
              aria-current={active === t.key ? 'page' : undefined}
              className="press flex h-full flex-1 items-center justify-center"
            >
              {icon(t.key, active === t.key)}
            </Link>
          ))}
        </div>
      </nav>
      <nav
        className="chrome fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r hairline bg-bg px-3 py-6 md:flex xl:w-[244px]"
        aria-label="Main"
      >
        <Link href="/" className="mb-8 px-3 xl:block">
          <span className="wordmark hidden xl:inline">lore</span>
          <span className="wordmark xl:hidden">l</span>
        </Link>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            onClick={(e) => go(t, e)}
            className={cn(
              'press mb-1 flex items-center gap-4 rounded-lg px-3 py-3 hover:bg-surface-2',
              active === t.key && 'font-bold',
            )}
          >
            {icon(t.key, active === t.key)}
            <span className="hidden text-[16px] xl:inline">{t.label}</span>
          </Link>
        ))}
        <Link
          href="/inbox"
          className="press mb-1 flex items-center gap-4 rounded-lg px-3 py-3 hover:bg-surface-2"
        >
          <span className="relative">
            <MessageCircle size={26} strokeWidth={1.75} />
            {!!unreadDms && (
              <span className="absolute -right-1.5 -top-1 rounded-full bg-heart px-1 text-[11px] font-semibold text-white">
                {unreadDms}
              </span>
            )}
          </span>
          <span className="hidden text-[16px] xl:inline">Messages</span>
        </Link>
        <Link
          href="/activity"
          className="press mb-1 flex items-center gap-4 rounded-lg px-3 py-3 hover:bg-surface-2"
        >
          <span className="relative">
            <Heart size={26} strokeWidth={1.75} />
            {!!unreadNotes && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-heart">
                <span className="sr-only">{unreadNotes} unread</span>
              </span>
            )}
          </span>
          <span className="hidden text-[16px] xl:inline">Notifications</span>
        </Link>
        <Link
          href="/explore"
          className="press mb-1 hidden items-center gap-4 rounded-lg px-3 py-3 hover:bg-surface-2"
        >
          <Compass size={26} />
        </Link>
      </nav>
    </>
  );
}
