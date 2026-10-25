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
    const p = { size: 24, strokeWidth: on ? 2.2 : 1.75 };
    switch (k) {
      case 'home':
        return <Home {...p} fill={on ? 'currentColor' : 'none'} />;
      case 'explore':
        return <Search {...p} />;
      case 'create':
        return <PlusSquare size={22} strokeWidth={2.2} />;
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
          <span className={cn('relative rounded-full p-[1.5px] transition-all', on && 'ring-2 ring-action')}>
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
        className="chrome fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-bg/95 backdrop-blur-md pb-safe md:hidden shadow-[0_-2px_12px_rgba(0,0,0,0.03)]"
        aria-label="Tabs"
      >
        <div className="flex h-[52px] items-center justify-around px-2">
          {tabs.map((t) => {
            const isCreate = t.key === 'create';
            const on = active === t.key;
            return (
              <Link
                key={t.key}
                href={t.href}
                onClick={(e) => go(t, e)}
                aria-label={t.label}
                aria-current={on ? 'page' : undefined}
                className="press flex h-full flex-1 items-center justify-center relative"
              >
                {isCreate ? (
                  <span className="flex h-[36px] w-[36px] items-center justify-center rounded-xl bg-action text-white shadow-md shadow-action/25 transition-transform active:scale-95">
                    <PlusSquare size={20} strokeWidth={2.2} />
                  </span>
                ) : (
                  <span
                    className={cn(
                      'flex items-center justify-center py-1.5 px-3 rounded-full transition-all duration-150',
                      on ? 'bg-surface-2 text-action' : 'text-ink-2 hover:text-ink',
                    )}
                  >
                    {icon(t.key, on)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      <nav
        className="chrome fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-line/80 bg-bg/95 px-3 py-6 backdrop-blur-md md:flex xl:w-[244px]"
        aria-label="Main"
      >
        <Link href="/" className="mb-8 px-3 xl:block">
          <div className="flex items-center gap-2">
            <span className="font-serif italic font-bold text-2xl tracking-tight text-ink hidden xl:inline">
              lore
            </span>
            <span className="font-serif italic font-bold text-2xl tracking-tight text-ink xl:hidden">l</span>
            <span className="hidden xl:inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
              circles
            </span>
          </div>
        </Link>
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <Link
              key={t.key}
              href={t.href}
              onClick={(e) => go(t, e)}
              className={cn(
                'press mb-1 flex items-center gap-4 rounded-xl px-3 py-2.5 transition-colors',
                on
                  ? 'bg-surface-2 text-action font-semibold'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              {icon(t.key, on)}
              <span className="hidden text-[15px] xl:inline">{t.label}</span>
            </Link>
          );
        })}
        <Link
          href="/inbox"
          className="press mb-1 flex items-center gap-4 rounded-xl px-3 py-2.5 text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
        >
          <span className="relative">
            <MessageCircle size={24} strokeWidth={1.75} />
            {!!unreadDms && (
              <span className="absolute -right-1.5 -top-1 rounded-full bg-heart px-1 text-[11px] font-semibold text-white">
                {unreadDms}
              </span>
            )}
          </span>
          <span className="hidden text-[15px] xl:inline">Messages</span>
        </Link>
        <Link
          href="/activity"
          className="press mb-1 flex items-center gap-4 rounded-xl px-3 py-2.5 text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
        >
          <span className="relative">
            <Heart size={24} strokeWidth={1.75} />
            {!!unreadNotes && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-heart">
                <span className="sr-only">{unreadNotes} unread</span>
              </span>
            )}
          </span>
          <span className="hidden text-[15px] xl:inline">Notifications</span>
        </Link>
        <Link
          href="/explore"
          className="press mb-1 hidden items-center gap-4 rounded-xl px-3 py-2.5 text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
        >
          <Compass size={24} />
        </Link>
      </nav>
    </>
  );
}
