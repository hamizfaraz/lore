'use client';
import type { ConnectionsDTO } from '@lore/shared/dto/graph';
import type { ExploreResultDTO } from '@lore/shared/dto/social';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { EmptyState, LoadError } from '@/components/ui/EmptyState';
import { Grid3 } from '@/components/ui/Grid3';
import { SearchField } from '@/components/ui/SearchField';
import { Skeleton } from '@/components/ui/Skeleton';
import { DiscoverTogetherEntry } from '@/features/discovery/DiscoverTogetherEntry';
import { FindFriendsEntry } from '@/features/discovery/FindFriendsEntry';
import { FriendsOnLore } from '@/features/profile/FriendsOnLore';
import { api } from '@/lib/api';
import { clientFlags } from '@/lib/flags';
import { qk } from '@/lib/query-keys';

const RECENT_KEY = 'lore.recentSearches';
function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** Search / Explore tab root [C1] (section 8.1 step 7, 9.2). */
export function ExploreScreen() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setRecent(loadRecent()), []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const grid = useInfiniteQuery({
    queryKey: qk.explore(''),
    queryFn: ({ pageParam }) =>
      api.get<ExploreResultDTO>(`/v1/explore${pageParam ? `?cursor=${pageParam}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const friends = useQuery({
    queryKey: qk.connections,
    queryFn: () => api.get<ConnectionsDTO>('/v1/graph/connections'),
    staleTime: 60_000,
  });
  const search = useQuery({
    queryKey: [...qk.explore(debounced), 'q'],
    queryFn: () => api.get<ExploreResultDTO>(`/v1/explore?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length > 0,
  });

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && grid.hasNextPage && !grid.isFetchingNextPage && grid.fetchNextPage(),
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [grid]);

  const remember = (term: string) => {
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 10);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  };
  const searching = focused || q.length > 0;

  return (
    <div className="mx-auto max-w-[935px]">
      <div className="chrome sticky top-0 z-30 flex items-center gap-3 bg-bg px-3 pb-2 pt-[calc(var(--safe-top)+8px)]">
        <SearchField
          className="flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => e.key === 'Enter' && q.trim() && remember(q.trim())}
          onClear={() => setQ('')}
        />
        {searching && (
          <button
            type="button"
            className="text-[15px] font-semibold"
            onClick={() => {
              setQ('');
              setFocused(false);
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {searching ? (
        <div>
          {clientFlags.findFriends && <FindFriendsEntry />}
          {!debounced && recent.length > 0 && (
            <>
              <div className="flex items-center justify-between px-4 pb-1 pt-3">
                <span className="text-[16px] font-bold">Recent</span>
                <button
                  type="button"
                  className="text-[14px] font-semibold text-action"
                  onClick={() => {
                    setRecent([]);
                    try {
                      localStorage.removeItem(RECENT_KEY);
                    } catch {}
                  }}
                >
                  Clear all
                </button>
              </div>
              {recent.map((r) => (
                <div key={r} className="flex items-center px-4 py-2">
                  <button type="button" className="flex-1 text-left text-[15px]" onClick={() => setQ(r)}>
                    {r}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${r}`}
                    onClick={() => setRecent((x) => x.filter((y) => y !== r))}
                  >
                    <X size={18} className="text-ink-2" />
                  </button>
                </div>
              ))}
            </>
          )}
          {(search.data?.accounts ?? []).map((a) => (
            <Link
              key={a.id}
              href={`/${a.type === 'group' ? 'g' : 'u'}/${a.handle}`}
              onClick={() => remember(a.handle)}
              className="press flex items-center gap-3 px-4 py-2"
            >
              {a.type === 'group' ? (
                <AvatarStack srcs={a.memberAvatars ?? [a.avatarUrl]} size={44} />
              ) : (
                <Avatar src={a.avatarUrl} name={a.displayName} size={44} />
              )}
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold">{a.handle}</span>
                <span className="block truncate text-[13px] text-ink-2">
                  {a.displayName}
                  {a.type === 'group' ? ' · Group' : ''}
                </span>
              </span>
            </Link>
          ))}
          {search.data && search.data.posts.length > 0 && (
            <div className="pt-3">
              <Grid3 posts={search.data.posts} />
            </div>
          )}
          {debounced && search.isError && (
            <LoadError body={(search.error as Error).message} onRetry={() => search.refetch()} />
          )}
          {debounced && search.data && !search.data.accounts.length && !search.data.posts.length && (
            <EmptyState title="No results" body={`Nothing found for “${debounced}”.`} />
          )}
        </div>
      ) : (
        <>
          {clientFlags.findFriends && (
            <div className="flex gap-2 px-3 pb-2">
              <FindFriendsEntry variant="tile" />
              <DiscoverTogetherEntry />
            </div>
          )}
          {(friends.data?.friendsOnLore?.length ?? 0) > 0 && (
            <section aria-label="Friends on LORE">
              <div className="flex items-center justify-between px-4 pb-1 pt-2">
                <h2 className="text-[16px] font-bold">Friends on LORE</h2>
                <Link href="/settings?section=facebook" className="text-[14px] font-semibold text-action">
                  See all
                </Link>
              </div>
              <FriendsOnLore friends={friends.data!.friendsOnLore!} compact />
            </section>
          )}
          {grid.isLoading ? (
            <div className="grid grid-cols-3 gap-px">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-none" />
              ))}
            </div>
          ) : grid.isError ? (
            <LoadError body={(grid.error as Error).message} onRetry={() => grid.refetch()} />
          ) : (grid.data?.pages.flatMap((p) => p.posts).length ?? 0) === 0 ? (
            <EmptyState
              title="No posts yet"
              body="Photos and reels from people you can see will show up here."
            />
          ) : (
            <Grid3 posts={grid.data?.pages.flatMap((p) => p.posts) ?? []} tallReels />
          )}
          <div ref={sentinel} />
        </>
      )}
    </div>
  );
}
