'use client';
import type { ConversationRowDTO } from '@lore/shared/dto/chat';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, MessageCircle, SquarePen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { SearchField } from '@/components/ui/SearchField';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { StackScreen } from '@/components/ui/StackScreen';
import { ThreadRow } from '@/components/ui/ThreadRow';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';
import { onEvent } from '@/lib/socket';
import { NewMessageSheet } from './NewMessageSheet';
import { upsertInboxRow } from './realtime';

/** DM inbox [C1]: handle with chevron, compose icon, search, Messages/Requests, rows (section 9.2). */
export function InboxPage() {
  const qc = useQueryClient();
  const me = useMe();
  const [q, setQ] = useState('');
  const [compose, setCompose] = useState(false);
  const inbox = useQuery({
    queryKey: qk.inbox,
    queryFn: () => api.get<{ items: ConversationRowDTO[] }>('/v1/conversations'),
  });
  useEffect(() => onEvent('conversation.updated', (e) => upsertInboxRow(qc, e.data)), [qc]);
  const rows = (inbox.data?.items ?? []).filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <StackScreen>
      <TopBar
        back
        title={
          <span className="inline-flex items-center gap-1 text-[18px] font-bold">
            {me.data?.personalAccount?.handle}
            <ChevronDown size={16} />
          </span>
        }
        right={
          <button type="button" aria-label="New message" className="press" onClick={() => setCompose(true)}>
            <SquarePen size={24} strokeWidth={1.75} />
          </button>
        }
      />
      <div className="mx-auto w-full max-w-[600px]">
        <div className="px-4 py-2">
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} />
        </div>
        <div className="flex items-center justify-between px-4 pb-1 pt-2">
          <span className="text-[16px] font-bold">Messages</span>
          <span className="text-[14px] font-semibold text-ink-2">Requests</span>
        </div>
        <PullToRefresh onRefresh={() => inbox.refetch()}>
          {inbox.isLoading && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}
          {!inbox.isLoading && rows.length === 0 && (
            <EmptyState
              icon={MessageCircle}
              title="Your messages"
              body="Send private messages to a friend or group."
              action={
                <button type="button" className="font-semibold text-action" onClick={() => setCompose(true)}>
                  Send message
                </button>
              }
            />
          )}
          {rows.map((r) => (
            <ThreadRow key={r.id} row={r} />
          ))}
        </PullToRefresh>
      </div>
      <NewMessageSheet open={compose} onOpenChange={setCompose} />
    </StackScreen>
  );
}
