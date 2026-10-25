'use client';
import type { ConversationRowDTO } from '@lore/shared/dto/chat';
import { useQuery } from '@tanstack/react-query';
import { CommentsSheet } from '@/components/ui/CommentsSheet';
import { ShareSheet } from '@/components/ui/ShareSheet';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import type { usePostActions } from './usePostActions';

/** Comments + share sheets wired to a usePostActions() instance. Sharing sends a post_share card to chats. */
export function PostSheets({ a }: { a: ReturnType<typeof usePostActions> }) {
  const me = useMe();
  const inbox = useQuery({
    queryKey: qk.inbox,
    queryFn: () => api.get<{ items: ConversationRowDTO[] }>('/v1/conversations'),
    enabled: Boolean(a.shareFor),
  });
  return (
    <>
      <CommentsSheet
        open={Boolean(a.commentsFor)}
        onOpenChange={(v) => !v && a.setCommentsFor(null)}
        comments={a.comments}
        loading={a.loadingComments}
        onSubmit={a.submitComment}
        me={
          me.data?.personalAccount
            ? {
                avatarUrl: me.data.personalAccount.avatarUrl,
                displayName: me.data.personalAccount.displayName,
              }
            : null
        }
      />
      <ShareSheet
        open={Boolean(a.shareFor)}
        onOpenChange={(v) => !v && a.setShareFor(null)}
        chats={inbox.data?.items ?? []}
        link={
          a.shareFor && typeof window !== 'undefined'
            ? `${window.location.origin}/p/${a.shareFor.id}`
            : undefined
        }
        onSend={async (ids) => {
          const post = a.shareFor;
          if (!post) return;
          await Promise.all(
            ids.map((cid) =>
              api.post(`/v1/conversations/${cid}/messages`, {
                clientId: crypto.randomUUID(),
                kind: 'card',
                cardKind: 'post_share',
                cardRefId: post.id,
              }),
            ),
          );
          void api.post(`/v1/posts/${post.id}/share`);
          toast('Sent');
        }}
      />
    </>
  );
}
