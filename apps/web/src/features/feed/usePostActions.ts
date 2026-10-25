'use client';
import type { CommentDTO, PostDTO } from '@lore/shared/dto/social';
import { type InfiniteData, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { PostHandlers } from '@/components/ui/PostCard';
import { api } from '@/lib/api';
import { toast } from '@/lib/store';

type Page = { items: PostDTO[]; nextCursor: string | null };

/** Patch a post everywhere it is cached (feed, profile grids, reels, single post). */
export function patchPostEverywhere(qc: QueryClient, id: string, patch: (p: PostDTO) => PostDTO) {
  for (const [key, data] of qc.getQueriesData<unknown>({})) {
    if (!data || typeof data !== 'object') continue;
    if ('pages' in (data as object)) {
      const d = data as InfiniteData<Page>;
      if (!d.pages?.[0]?.items) continue;
      qc.setQueryData<InfiniteData<Page>>(key, {
        ...d,
        pages: d.pages.map((pg) => ({ ...pg, items: pg.items.map((p) => (p.id === id ? patch(p) : p)) })),
      });
    } else if ((data as PostDTO).id === id && 'likeCount' in (data as object)) {
      qc.setQueryData<PostDTO>(key, patch(data as PostDTO));
    }
  }
}

/** Optimistic likes/saves, comments sheet and share sheet state for any list of posts. */
export function usePostActions() {
  const qc = useQueryClient();
  const [commentsFor, setCommentsFor] = useState<PostDTO | null>(null);
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [shareFor, setShareFor] = useState<PostDTO | null>(null);

  const onLike = useCallback(
    async (post: PostDTO, like: boolean) => {
      patchPostEverywhere(qc, post.id, (p) => ({
        ...p,
        likedByMe: like,
        likeCount: Math.max(0, p.likeCount + (like ? 1 : -1)),
      }));
      try {
        const r = await (like
          ? api.post<{ likeCount: number }>(`/v1/posts/${post.id}/like`)
          : api.del<{ likeCount: number }>(`/v1/posts/${post.id}/like`));
        patchPostEverywhere(qc, post.id, (p) => ({ ...p, likeCount: r.likeCount }));
      } catch (e) {
        patchPostEverywhere(qc, post.id, (p) => ({
          ...p,
          likedByMe: !like,
          likeCount: Math.max(0, p.likeCount + (like ? -1 : 1)),
        }));
        toast((e as Error).message, 'error');
      }
    },
    [qc],
  );
  const onSave = useCallback(
    async (post: PostDTO, save: boolean) => {
      patchPostEverywhere(qc, post.id, (p) => ({ ...p, savedByMe: save }));
      try {
        await (save ? api.post(`/v1/posts/${post.id}/save`) : api.del(`/v1/posts/${post.id}/save`));
        if (save) toast('Saved');
      } catch (e) {
        patchPostEverywhere(qc, post.id, (p) => ({ ...p, savedByMe: !save }));
        toast((e as Error).message, 'error');
      }
    },
    [qc],
  );
  const onComment = useCallback(async (post: PostDTO) => {
    setCommentsFor(post);
    setLoadingComments(true);
    try {
      setComments((await api.get<{ items: CommentDTO[] }>(`/v1/posts/${post.id}/comments`)).items);
    } finally {
      setLoadingComments(false);
    }
  }, []);
  const submitComment = useCallback(
    async (body: string) => {
      if (!commentsFor) return;
      const c = await api.post<CommentDTO>(`/v1/posts/${commentsFor.id}/comments`, { body });
      setComments((xs) => [...xs, c]);
      patchPostEverywhere(qc, commentsFor.id, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
    },
    [commentsFor, qc],
  );
  const handlers: PostHandlers = { onLike, onSave, onComment, onShare: (p) => setShareFor(p) };
  return {
    handlers,
    commentsFor,
    setCommentsFor,
    comments,
    loadingComments,
    submitComment,
    shareFor,
    setShareFor,
  };
}
