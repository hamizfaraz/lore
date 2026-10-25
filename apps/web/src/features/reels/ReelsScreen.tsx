'use client';
import type { PostDTO } from '@lore/shared/dto/social';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Camera, Clapperboard } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReelPlayer } from '@/components/ui/ReelPlayer';
import { PostSheets } from '@/features/feed/PostSheets';
import { usePostActions } from '@/features/feed/usePostActions';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';

/** Reels tab root [C1]: vertical snap pager, autoplay muted, tap to unmute, one video mounted at a time (section 8.1 step 6). */
export function ReelsScreen() {
  const actions = usePostActions();
  const [muted, setMuted] = useState(true);
  const sentinel = useRef<HTMLDivElement>(null);
  const q = useInfiniteQuery({
    queryKey: qk.reels,
    queryFn: ({ pageParam }) =>
      api.get<{ items: PostDTO[]; nextCursor: string | null }>(
        `/v1/reels${pageParam ? `?cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage(),
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q]);
  const reels = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="relative h-dvh bg-black md:mx-auto md:max-w-[420px]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[calc(var(--safe-top)+10px)] text-white">
        <span className="text-[22px] font-bold">Reels</span>
        <Link href="/create" aria-label="New reel" className="pointer-events-auto">
          <Camera size={26} />
        </Link>
      </div>
      {!q.isLoading && reels.length === 0 ? (
        <div className="flex h-full items-center justify-center text-white">
          <EmptyState
            icon={Clapperboard}
            title="No reels yet"
            body="Share a short video from Create → REEL."
          />
        </div>
      ) : (
        <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain" data-scroll>
          {reels.map((p) => (
            <div key={p.id} className="h-dvh w-full snap-start">
              <ReelPlayer
                post={p}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                onLike={() => actions.handlers.onLike(p, !p.likedByMe)}
                onComment={() => actions.handlers.onComment(p)}
                onShare={() => actions.handlers.onShare(p)}
                onSave={() => actions.handlers.onSave(p, !p.savedByMe)}
              />
            </div>
          ))}
          <div ref={sentinel} className="h-px" />
        </div>
      )}
      <PostSheets a={actions} />
    </div>
  );
}
