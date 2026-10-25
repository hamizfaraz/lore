'use client';
import type { ConversationRowDTO, MessageDTO } from '@lore/shared/dto/chat';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';

export type MsgPage = { items: MessageDTO[]; nextCursor: string | null };

/** Typed reducers that socket events apply to TanStack Query caches (section 4 client state). */
export function upsertMessage(qc: QueryClient, msg: MessageDTO) {
  qc.setQueryData<InfiniteData<MsgPage>>(qk.messages(msg.conversationId), (d) => {
    if (!d) return d;
    const exists = d.pages.some((p) => p.items.some((m) => m.id === msg.id));
    if (exists)
      return {
        ...d,
        pages: d.pages.map((p) => ({ ...p, items: p.items.map((m) => (m.id === msg.id ? msg : m)) })),
      };
    const [first, ...rest] = d.pages;
    return {
      ...d,
      pages: [
        {
          ...first,
          items: [...first.items, msg].sort(
            (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
          ),
        },
        ...rest,
      ],
    };
  });
}

export function patchMessage(
  qc: QueryClient,
  conversationId: string,
  id: string,
  patch: Partial<MessageDTO>,
) {
  qc.setQueryData<InfiniteData<MsgPage>>(qk.messages(conversationId), (d) =>
    d
      ? {
          ...d,
          pages: d.pages.map((p) => ({
            ...p,
            items: p.items.map((m) => (m.id === id ? { ...m, ...patch } : m)),
          })),
        }
      : d,
  );
}

export function upsertInboxRow(qc: QueryClient, row: ConversationRowDTO) {
  qc.setQueryData<{ items: ConversationRowDTO[]; nextCursor: null }>(qk.inbox, (d) => {
    if (!d) return d;
    const removed = row.title === '' && row.lastMessage === null && row.updatedAt.startsWith('1970');
    const others = d.items.filter((r) => r.id !== row.id);
    const items = removed ? others : [row, ...others];
    return {
      ...d,
      items: items.sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
      ),
    };
  });
}

export const flatMessages = (d?: InfiniteData<MsgPage>) =>
  d ? [...d.pages].reverse().flatMap((p) => p.items) : [];
