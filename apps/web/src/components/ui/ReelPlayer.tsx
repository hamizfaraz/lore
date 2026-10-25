'use client';
import type { PostDTO } from '@lore/shared/dto/social';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { compact } from '@/lib/time';
import { cn } from '@/lib/cn';
import { Avatar } from './Avatar';

/**
 * One reel in the vertical pager: autoplay muted, tap to unmute; only the visible reel plays
 * (IntersectionObserver), right action rail, bottom-left author + caption (section 9.2).
 */
export function ReelPlayer({
  post,
  onLike,
  onComment,
  onShare,
  onSave,
  muted,
  onToggleMute,
}: {
  post: PostDTO;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const media = post.media[0];

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting && e.intersectionRatio > 0.6), {
      threshold: [0, 0.6, 1],
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else {
      v.pause();
      v.currentTime = 0;
    }
  }, [active]);

  const href = `/${post.author.type === 'group' ? 'g' : 'u'}/${post.author.handle}`;
  return (
    <div ref={box} className="relative h-full w-full snap-start snap-always bg-black text-white">
      {media && active ? (
        <video
          ref={vid}
          src={media.url}
          poster={media.thumbUrl ?? undefined}
          className="h-full w-full object-cover"
          muted={muted}
          loop
          playsInline
          aria-label={media.altText || post.altText || post.caption || 'Reel'}
          onClick={onToggleMute}
        >
          {media.transcript && (
            <track
              kind="captions"
              srcLang="en"
              default
              src={`data:text/vtt;charset=utf-8,${encodeURIComponent(`WEBVTT\n\n00:00:00.000 --> 00:01:00.000\n${media.transcript}`)}`}
            />
          )}
        </video>
      ) : (
        media?.thumbUrl && (
          <img
            src={media.thumbUrl}
            alt={media.altText || post.altText || post.caption || ''}
            className="h-full w-full object-cover"
          />
        )
      )}
      <button
        type="button"
        aria-label={muted ? 'Unmute' : 'Mute'}
        onClick={onToggleMute}
        className="absolute right-3 top-[calc(var(--safe-top)+56px)] flex h-[44px] w-[44px] items-center justify-center rounded-full bg-black/50"
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <div className="absolute bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+16px)] right-3 flex flex-col items-center gap-5">
        <RailBtn name={post.likedByMe ? 'Unlike' : 'Like'} onClick={onLike} label={compact(post.likeCount)}>
          <Heart
            size={28}
            fill={post.likedByMe ? '#FF3040' : 'none'}
            className={cn(post.likedByMe && 'text-heart')}
          />
        </RailBtn>
        <RailBtn name="Comment" onClick={onComment} label={compact(post.commentCount)}>
          <MessageCircle size={28} className="-scale-x-100" />
        </RailBtn>
        <RailBtn name="Share" onClick={onShare}>
          <Send size={26} />
        </RailBtn>
        <RailBtn name={post.savedByMe ? 'Remove from saved' : 'Save'} onClick={onSave}>
          <Bookmark size={26} fill={post.savedByMe ? 'currentColor' : 'none'} />
        </RailBtn>
        <MoreHorizontal size={24} />
        <span className="h-7 w-7 overflow-hidden rounded-md border-2 border-white">
          <Avatar src={post.author.avatarUrl} name={post.author.displayName} size={24} />
        </span>
      </div>
      <div className="absolute bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+16px)] left-3 right-20 space-y-2">
        <Link href={href} className="flex items-center gap-2 font-semibold">
          <Avatar src={post.author.avatarUrl} name={post.author.displayName} size={32} />
          {post.author.handle}
        </Link>
        {post.caption && <p className="line-clamp-2 text-[14px]">{post.caption}</p>}
        {post.sourceKind === 'recap' && <p className="text-[12px] opacity-90">Created from shared moments</p>}
        <p className="text-[12px] opacity-90">♪ Original audio · {post.author.handle}</p>
      </div>
    </div>
  );
}

function RailBtn({
  children,
  label,
  name,
  onClick,
}: { children: React.ReactNode; label?: string; name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={name}
      onClick={onClick}
      className="press flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 text-[12px] font-semibold"
    >
      {children}
      {label && <span>{label}</span>}
    </button>
  );
}
