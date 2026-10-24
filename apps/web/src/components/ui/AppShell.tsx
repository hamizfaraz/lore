'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { type TabKey, useUi } from '@/lib/store';
import { InstallPrompt } from './InstallPrompt';
import { type TabDef, TabBar } from './TabBar';

/**
 * Native app shell (section 9.3): fixed tab bar; tab roots stay MOUNTED (hidden with display:none)
 * so each tab keeps scroll position and state; pushed screens (route `children`) render above the
 * root of the tab they were pushed from, which shifts 30% left and dims underneath.
 */
export function AppShell({
  roots,
  children,
  me,
  profileDot,
  unreadDms,
}: {
  roots: Partial<Record<TabKey, React.ReactNode>>;
  children: React.ReactNode;
  me: { handle: string; avatarUrl: string | null; displayName: string } | null;
  profileDot?: boolean;
  unreadDms?: number;
}) {
  const pathname = usePathname();
  const setLastPath = useUi((s) => s.setLastPath);
  const scrollers = useRef<Partial<Record<TabKey, HTMLDivElement | null>>>({});
  const tabs: TabDef[] = [
    { key: 'home', href: '/', label: 'Home' },
    { key: 'explore', href: '/explore', label: 'Search' },
    { key: 'create', href: '/create', label: 'Create' },
    { key: 'reels', href: '/reels', label: 'Reels' },
    { key: 'profile', href: me ? `/u/${me.handle}` : '/settings', label: 'Profile' },
  ];
  const rootFor = (p: string): TabKey | null => {
    if (p === '/') return 'home';
    if (p === '/explore') return 'explore';
    if (p === '/reels') return 'reels';
    if (me && p === `/u/${me.handle}`) return 'profile';
    return null;
  };
  const rootActive = rootFor(pathname);
  const lastRoot = useRef<TabKey>('home');
  if (rootActive) lastRoot.current = rootActive;
  const tabOfPath = rootActive ?? (pathname.startsWith('/create') ? 'create' : lastRoot.current);
  const pushed = !rootActive;

  useEffect(() => {
    if (tabOfPath !== 'create') setLastPath(tabOfPath, pathname);
  }, [pathname, tabOfPath, setLastPath]);

  const reselect = (k: TabKey) => scrollers.current[k]?.scrollTo({ top: 0, behavior: 'smooth' });
  const hideTabBar =
    pathname.startsWith('/c/') ||
    pathname.startsWith('/stories') ||
    pathname.startsWith('/story-camera') ||
    pathname.startsWith('/create');

  return (
    <div className="relative min-h-dvh md:pl-[72px] xl:pl-[244px]">
      {(Object.keys(roots) as TabKey[]).map((k) => (
        <div
          key={k}
          ref={(el) => {
            scrollers.current[k] = el;
          }}
          data-scroll
          className={cn(
            'h-dvh overflow-y-auto overscroll-contain transition-[transform,filter] duration-300 [transition-timing-function:var(--ease-ios)]',
            k === tabOfPath ? 'block' : 'hidden',
            pushed &&
              k === tabOfPath &&
              '-translate-x-[30%] brightness-75 md:hidden md:translate-x-0 md:brightness-100',
            !hideTabBar && 'pb-[calc(var(--tabbar-h)+var(--safe-bottom))] md:pb-0',
          )}
          aria-hidden={k !== tabOfPath || pushed}
        >
          {roots[k]}
        </div>
      ))}
      {pushed && children}
      {!hideTabBar && (
        <TabBar
          tabs={tabs}
          active={tabOfPath}
          avatarUrl={me?.avatarUrl}
          name={me?.displayName}
          profileDot={profileDot}
          onReselect={reselect}
          unreadDms={unreadDms}
        />
      )}
      <InstallPrompt />
    </div>
  );
}
