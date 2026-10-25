'use client';
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';

/** heart, comment, share left; bookmark right; icons spaced 16 (section 9.1/9.2). */
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
    <div className={cn('chrome flex items-center px-1', className)}>
      <div className="flex items-center">
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          aria-label={liked ? 'Unlike' : 'Like'}
          aria-pressed={liked}
          onClick={onLike}
          className={cn('press flex h-[44px] w-[44px] items-center justify-center', liked && 'text-heart')}
        >
          <Heart size={24} strokeWidth={1.75} fill={liked ? 'currentColor' : 'none'} />
        </motion.button>
        <button
          type="button"
          aria-label="Comment"
          onClick={onComment}
          className="press flex h-[44px] w-[44px] items-center justify-center"
        >
          <MessageCircle size={24} strokeWidth={1.75} className="-scale-x-100" />
        </button>
        <button
          type="button"
          aria-label="Share"
          onClick={onShare}
          className="press flex h-[44px] w-[44px] items-center justify-center"
        >
          <Send size={23} strokeWidth={1.75} />
        </button>
      </div>
      <button
        type="button"
        aria-label={saved ? 'Remove from saved' : 'Save'}
        aria-pressed={saved}
        onClick={onSave}
        className="press ml-auto flex h-[44px] w-[44px] items-center justify-center"
      >
        <Bookmark size={24} strokeWidth={1.75} fill={saved ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
