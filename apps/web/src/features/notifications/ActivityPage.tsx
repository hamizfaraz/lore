'use client';
import type { NotificationDTO } from '@lore/shared/dto/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState, LoadError } from '@/components/ui/EmptyState';
import { NotificationRow } from '@/components/ui/NotificationRow';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { onEvent } from '@/lib/socket';

type Page = { items: NotificationDTO[]; nextCursor: string | null; unread: number };

function section(iso: string) {
  const age = Date.now() - new Date(iso).getTime();
  if (age < 24 * 3600_000) return 'Today';
  if (age < 7 * 24 * 3600_000) return 'This week';
  if (age < 31 * 24 * 3600_000) return 'This month';
  return 'Earlier';
}

/** Notifications [C1]: Today / This week / This month, deep links per kind (section 8.3, 9.2). */
export function ActivityPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.notifications, queryFn: () => api.get<Page>('/v1/notifications') });
  useEffect(() => {
    if (q.data?.unread)
      void api
        .post('/v1/notifications/read', {})
        .then(() => qc.invalidateQueries({ queryKey: [...qk.notifications, 'unread'] }));
  }, [q.data?.unread, qc]);
  useEffect(
    () => onEvent('notification.created', () => qc.invalidateQueries({ queryKey: qk.notifications })),
    [qc],
  );
  const groups = new Map<string, NotificationDTO[]>();
  for (const n of q.data?.items ?? [])
    groups.set(section(n.createdAt), [...(groups.get(section(n.createdAt)) ?? []), n]);
  return (
    <StackScreen>
      <TopBar back title="Notifications" />
      <div className="mx-auto w-full max-w-[600px]">
        <PullToRefresh onRefresh={() => q.refetch()}>
          {q.isLoading && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} avatar={44} />)}
          {q.isError && <LoadError body={(q.error as Error).message} onRetry={() => q.refetch()} />}
          {!q.isLoading && !q.isError && !q.data?.items.length && (
            <EmptyState
              icon={Heart}
              title="Activity on your posts"
              body="When someone likes, comments, or your group needs your approval, you'll see it here."
            />
          )}
          {[...groups.entries()].map(([label, items]) => (
            <section key={label} className="border-b hairline pb-2">
              <h2 className="px-4 pb-1 pt-4 text-[16px] font-bold">{label}</h2>
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  action={
                    n.kind === 'draft_needs_approval' ? (
                      <Button size="sm">Review</Button>
                    ) : n.kind === 'follow' ? (
                      <Button size="sm" variant="secondary">
                        View
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </section>
          ))}
        </PullToRefresh>
      </div>
    </StackScreen>
  );
}
