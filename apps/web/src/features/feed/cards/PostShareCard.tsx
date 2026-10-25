'use client';
import type { PostDTO } from '@lore/shared/dto/social';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { BlurImage } from '@/components/ui/BlurImage';
import type { CardProps } from '@/features/chat/cards/types';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';

/** `post_share` card [C1]: a shared post renders as a media card inside the chat (section 9.2). */
export default function PostShareCard({ message, data }: CardProps<'post_share'>) {
  const id = message.cardRefId;
  const q = useQuery({
    queryKey: qk.post(id ?? ''),
    queryFn: () => api.get<PostDTO>(`/v1/posts/${id}`),
    enabled: !data && Boolean(id),
    retry: false,
  });
  const post = data ?? q.data;
  if (!post) return <div className="h-40 w-[240px] animate-pulse rounded-2xl bg-surface-2" />;
  const m = post.media[0];
  return (
    <Link href={`/p/${post.id}`} className="block w-[240px] overflow-hidden rounded-2xl bg-surface-2">
      <div className="flex items-center gap-2 px-3 py-2">
        <Avatar src={post.author.avatarUrl} name={post.author.displayName} size={24} />
        <span className="text-[13px] font-semibold">{post.author.handle}</span>
      </div>
      {m && (
        <div className="aspect-square">
          <BlurImage src={m.thumbUrl ?? m.url} blurhash={m.blurhash} />
        </div>
      )}
      {post.caption && (
        <p className="line-clamp-2 px-3 py-2 text-[13px]">
          <b>{post.author.handle}</b> {post.caption}
        </p>
      )}
    </Link>
  );
}
