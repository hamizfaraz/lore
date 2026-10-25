'use client';
import type { PostDTO } from '@lore/shared/dto/social';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { tap } from '@/lib/haptics';
import { ago, compact } from '@/lib/time';
import { ActionRow } from './ActionRow';
import { Avatar, AvatarStack } from './Avatar';
import { BlurImage } from './BlurImage';
import { Carousel } from './Carousel';
import { AiPill, ConfirmedPill } from './Labels';
import { LikeBurst } from './LikeBurst';

export type PostHandlers = {
  onLike: (post: PostDTO, like: boolean) => void;
  onSave: (post: PostDTO, save: boolean) => void;
  onComment: (post: PostDTO) => void;
  onShare: (post: PostDTO) => void;
  onMore?: (post: PostDTO) => void;
};

/** Post anatomy mirroring Instagram (section 9.2), with LORE group-post additions. */
export function PostCard({ post, handlers }: { post: PostDTO; handlers: PostHandlers }) {
  const [burst, setBurst] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const lastTap = useRef(0);
  const isGroup = post.author.type === 'group';
  const href = `/${isGroup ? 'g' : 'u'}/${post.author.handle}`;
  const first = post.media[0];
  const aspect =
    first?.width && first?.height ? Math.min(1.91, Math.max(0.8, first.width / first.height)) : 1;

  const onMediaTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setBurst((b) => b + 1);
      tap();
      if (!post.likedByMe) handlers.onLike(post, true);
    }
    lastTap.current = now;
  };

  const slides = post.media.map((m) => (
    <div key={m.id} className="absolute inset-0" onClick={onMediaTap}>
      {m.kind === 'video' ? (
        <video
          src={m.url}
          poster={m.thumbUrl ?? undefined}
          className="h-full w-full object-cover"
          muted
          playsInline
          loop
          autoPlay
          aria-label={m.altText || post.altText || post.caption || 'Video'}
        >
          {m.transcript && (
            <track
              kind="captions"
              srcLang="en"
              default
              src={`data:text/vtt;charset=utf-8,${encodeURIComponent(`WEBVTT\n\n00:00:00.000 --> 00:01:00.000\n${m.transcript}`)}`}
            />
          )}
        </video>
      ) : (
        <BlurImage src={m.url} blurhash={m.blurhash} alt={m.altText ?? post.altText ?? ''} />
      )}
      {m.aiGenerated && <AiPill className="absolute bottom-3 left-3" label="AI illustration" />}
    </div>
  ));

  const caption = post.caption ?? '';
  const long = caption.length > 120;

  return (
    <article
      className="feed-card mx-2 sm:mx-0 my-3.5 pb-3.5 overflow-hidden transition-all duration-200"
      aria-label={`Post by ${post.author.handle}`}
    >
      <header className="chrome flex items-center justify-between gap-2.5 px-3.5 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href={href} className="press shrink-0">
            {isGroup ? (
              <AvatarStack srcs={post.author.memberAvatars ?? [post.author.avatarUrl]} size={36} />
            ) : (
              <Avatar src={post.author.avatarUrl} name={post.author.displayName} size={36} />
            )}
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5 truncate">
              <Link href={href} className="truncate text-[14px] font-semibold text-ink hover:underline">
                {post.author.handle}
              </Link>
              {isGroup && (
                <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50">
                  Group
                </span>
              )}
            </div>
            {post.locationLabel && (
              <span className="block truncate text-[11px] text-ink-2 font-medium">{post.locationLabel}</span>
            )}
          </div>
        </div>
        {handlers.onMore && (
          <button
            type="button"
            aria-label="More"
            className="press flex h-[34px] w-[34px] items-center justify-center rounded-full hover:bg-surface-2 transition text-ink-2"
            onClick={() => handlers.onMore?.(post)}
          >
            <MoreHorizontal size={19} />
          </button>
        )}
      </header>
      <div className="relative overflow-hidden bg-surface-2">
        <Carousel slides={slides} aspect={aspect} />
        <LikeBurst show={burst} />
      </div>
      <ActionRow
        liked={post.likedByMe}
        saved={post.savedByMe}
        onLike={() => {
          tap();
          handlers.onLike(post, !post.likedByMe);
        }}
        onComment={() => handlers.onComment(post)}
        onShare={() => handlers.onShare(post)}
        onSave={() => handlers.onSave(post, !post.savedByMe)}
      />
      <div className="space-y-1.5 px-3.5 pt-1.5 text-[14px]">
        {post.likeCount > 0 && (
          <p className="text-[13px] font-semibold text-ink">
            {post.likedBy.length > 0 && post.likeCount > 1 ? (
              <>
                Liked by {post.likedBy[0]} and {compact(post.likeCount - 1)}{' '}
                {post.likeCount - 1 === 1 ? 'other' : 'others'}
              </>
            ) : (
              <>
                {compact(post.likeCount)} {post.likeCount === 1 ? 'like' : 'likes'}
              </>
            )}
          </p>
        )}
        {caption && (
          <p className="whitespace-pre-line break-words text-[13.5px] leading-relaxed">
            <Link href={href} className="mr-1.5 font-semibold text-ink">
              {post.author.handle}
            </Link>
            {long && !expanded ? (
              <>
                {caption.slice(0, 120).trimEnd()}…{' '}
                <button type="button" className="text-action font-medium" onClick={() => setExpanded(true)}>
                  more
                </button>
              </>
            ) : (
              caption
            )}
          </p>
        )}
        {isGroup && (post.sourceKind === 'recap' || post.approvedByCount) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[12px] text-ink-2">
            {post.sourceKind === 'recap' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ai-tint text-ai font-medium text-[11px]">
                ✨ Shared moments recap
              </span>
            )}
            {post.approvedByCount ? (
              <ConfirmedPill text={`Approved by ${post.approvedByCount} members`} />
            ) : null}
          </div>
        )}
        {post.commentCount > 0 && (
          <button
            type="button"
            className="block text-[12px] font-medium text-ink-2 hover:text-ink transition"
            onClick={() => handlers.onComment(post)}
          >
            View {post.commentCount === 1 ? '1 comment' : `all ${post.commentCount} comments`}
          </button>
        )}
        <time className="block text-[11px] text-ink-2 font-medium" dateTime={post.publishedAt}>
          {ago(post.publishedAt)}
        </time>
      </div>
    </article>
  );
}
