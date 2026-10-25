'use client';
import type { PostDTO } from '@lore/shared/dto/social';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostCard } from '@/components/ui/PostCard';
import { PostSkeleton } from '@/components/ui/Skeleton';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { Lock } from 'lucide-react';
import { PostSheets } from './PostSheets';
import { usePostActions } from './usePostActions';

export function PostPage({ id }: { id: string }) {
  const q = useQuery({
    queryKey: qk.post(id),
    queryFn: () => api.get<PostDTO>(`/v1/posts/${id}`),
    retry: false,
  });
  const actions = usePostActions();
  return (
    <StackScreen>
      <TopBar title="Post" back />
      <div className="mx-auto w-full max-w-[470px]">
        {q.isLoading && <PostSkeleton />}
        {q.error && <EmptyState icon={Lock} title="Post unavailable" body={(q.error as Error).message} />}
        {q.data && <PostCard post={q.data} handlers={actions.handlers} />}
      </div>
      <PostSheets a={actions} />
    </StackScreen>
  );
}
