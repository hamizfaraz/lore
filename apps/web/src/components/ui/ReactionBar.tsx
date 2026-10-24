'use client';
import { motion } from 'motion/react';

export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

/** Long-press reaction bar above a bubble. */
export function ReactionBar({ onPick, onReply }: { onPick: (emoji: string) => void; onReply?: () => void }) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="chrome flex items-center gap-1 rounded-full bg-elevated px-2 py-1.5 shadow-xl"
    >
      {QUICK_REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className="press-btn px-1 text-[26px] leading-none"
        >
          {e}
        </button>
      ))}
      {onReply && (
        <button
          type="button"
          onClick={onReply}
          className="press ml-1 rounded-full bg-surface-2 px-3 py-1 text-[13px] font-semibold"
        >
          Reply
        </button>
      )}
    </motion.div>
  );
}
