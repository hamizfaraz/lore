'use client';
import type { PostDTO, StoryRailItemDTO } from '@lore/shared/dto/social';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDrag } from '@use-gesture/react';
import { Heart, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { EmptyState, LoadError } from '@/components/ui/EmptyState';
import { PostCard } from '@/components/ui/PostCard';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { PostSkeleton } from '@/components/ui/Skeleton';
import { StoriesRail } from '@/components/ui/StoriesRail';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';
import { onEvent } from '@/lib/socket';
import { DesktopAside } from './DesktopAside';
import { PostSheets } from './PostSheets';
import { usePostActions } from './usePostActions';

type Page = { items: PostDTO[]; nextCursor: string | null };

/** Home tab root [C1]: wordmark, heart + messenger, stories rail, feed (section 9.2). */
export function HomeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const actions = usePostActions();
  const feed = useInfiniteQuery({
    queryKey: qk.feed,
    // Keep the initial URL versioned so an older service-worker demo snapshot cannot mask a
    // freshly seeded dataset. Cursor pages are naturally unique, but retain the version too.
    queryFn: ({ pageParam }) =>
      api.get<Page>(
        `/v1/feed?dataset=rich-demo-v1${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rail = useQuery({
    queryKey: qk.storiesRail,
    queryFn: () => api.get<StoryRailItemDTO[]>('/v1/stories/rail'),
  });
  const unread = useQuery({
    queryKey: [...qk.notifications, 'unread'],
    queryFn: () => api.get<{ unread: number }>('/v1/notifications'),
    refetchInterval: 60_000,
  });
  const inbox = useQuery({
    queryKey: qk.inbox,
    queryFn: () => api.get<{ items: { unreadCount: number }[] }>('/v1/conversations'),
    retry: false,
  });
  const unreadDms = inbox.data?.items.filter((c) => c.unreadCount > 0).length ?? 0;
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage(),
      { rootMargin: '800px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feed]);

  useEffect(() => {
    const offs = [
      onEvent('post.published', () => qc.invalidateQueries({ queryKey: qk.feed })),
      onEvent('notification.created', () =>
        qc.invalidateQueries({ queryKey: [...qk.notifications, 'unread'] }),
      ),
    ];
    return () => offs.forEach((o) => o());
  }, [qc]);

  const posts = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const acct = me.data?.personalAccount;
  const swipe = useDrag(
    ({ movement: [mx, my], last, event, cancel }) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-carousel]')) return cancel();
      if (Math.abs(mx) < Math.abs(my)) return;
      if (!last || Math.abs(mx) < 90) return;
      router.push(mx < 0 ? '/inbox' : '/story-camera');
    },
    { axis: 'x', filterTaps: true, pointer: { touch: true }, threshold: 16 },
  );
  return (
    <div className="xl:mx-auto xl:flex xl:max-w-[935px] xl:justify-center xl:gap-16 xl:px-4">
      <div className="mx-auto w-full max-w-[470px] md:pt-4" {...swipe()}>
        <TopBar
          className="md:hidden"
          border={false}
          left={<span className="wordmark">lore</span>}
          right={
            <>
              <Link
                href="/activity"
                aria-label={unread.data?.unread ? 'Notifications, unread' : 'Notifications'}
                className="press relative flex h-[44px] w-[44px] items-center justify-center"
              >
                <Heart size={26} strokeWidth={1.75} />
                {!!unread.data?.unread && (
                  <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-heart" />
                )}
              </Link>
              <Link
                href="/inbox"
                aria-label="Messages"
                className="press relative flex h-[44px] w-[44px] items-center justify-center"
              >
                <MessageCircle size={26} strokeWidth={1.75} className="-scale-x-100" />
                {unreadDms > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-heart px-1 text-[11px] font-semibold text-white">
                    {unreadDms}
                  </span>
                )}
              </Link>
            </>
          }
        />
        <PullToRefresh onRefresh={() => Promise.all([feed.refetch(), rail.refetch()])}>
          <StoriesRail
            items={rail.data ?? []}
            me={acct ? { id: acct.id, avatarUrl: acct.avatarUrl, displayName: acct.displayName } : null}
            onOpen={(id) => router.push(`/stories/${id}`)}
            onCreate={() => router.push('/story-camera')}
          />
          <div className="border-t hairline" />
          {feed.isLoading && [0, 1].map((i) => <PostSkeleton key={i} />)}
          {feed.isError && <LoadError body={(feed.error as Error).message} onRetry={() => feed.refetch()} />}
          {!feed.isLoading && !feed.isError && posts.length === 0 && (
            <EmptyState
              icon={Heart}
              title="Welcome to LORE"
              body="Follow friends or start a group chat to see posts here."
              action={
                <Link href="/explore" className="font-semibold text-action">
                  Find people
                </Link>
              }
            />
          )}
          {posts.map((p) => (
            <PostCard key={p.id} post={p} handlers={actions.handlers} />
          ))}
          <div ref={sentinel} />
          {feed.isFetchingNextPage && <PostSkeleton />}
        </PullToRefresh>
      </div>
      <DesktopAside />
      <PostSheets a={actions} />
    </div>
  );
}
