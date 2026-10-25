'use client';
import { Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';

/** Refreshed action bar: tactile pill buttons with subtle micro-interactions. */
export function ActionRow({
  liked,
  saved,
  onLike,
  onComment,
  onShare,
  onSave,
  className,
}: {
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  className?: string;
}) {
  return (
    <div className={cn('chrome flex items-center justify-between px-3 pt-2.5 pb-1', className)}>
      <div className="flex items-center gap-1.5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          aria-label={liked ? 'Unlike' : 'Like'}
          aria-pressed={liked}
          onClick={onLike}
          className={cn(
            'press flex h-[38px] w-[38px] items-center justify-center rounded-full transition-colors',
            liked
              ? 'text-heart bg-rose-50 dark:bg-rose-950/40'
              : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
          )}
        >
          <Heart size={21} strokeWidth={2} fill={liked ? 'currentColor' : 'none'} />
        </motion.button>
        <button
          type="button"
          aria-label="Comment"
          onClick={onComment}
          className="press flex h-[38px] w-[38px] items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
        >
          <MessageCircle size={21} strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Share"
          onClick={onShare}
          className="press flex h-[38px] w-[38px] items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
        >
          <Share2 size={20} strokeWidth={2} />
        </button>
      </div>
      <button
        type="button"
        aria-label={saved ? 'Remove from saved' : 'Save'}
        aria-pressed={saved}
        onClick={onSave}
        className={cn(
          'press flex h-[38px] w-[38px] items-center justify-center rounded-full transition-colors',
          saved
            ? 'text-action bg-indigo-50 dark:bg-indigo-950/40'
            : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        )}
      >
        <Bookmark size={20} strokeWidth={2} fill={saved ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
