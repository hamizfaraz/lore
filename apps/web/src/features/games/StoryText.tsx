'use client';
import type { GameStateDTO } from '@lore/shared/dto/games';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';

/**
 * Enhanced living StoryText [C1 / Playmode]:
 * Words dynamically glow in the author's color with animated entry and punctuation-aware typography.
 */
export function StoryText({
  words,
  participants,
  big,
}: {
  words: { word: string; userId: string }[];
  participants: GameStateDTO['participants'];
  big?: boolean;
}) {
  const authorMap = new Map(participants.map((p) => [p.userId, p]));
  const defaultPalette = ['#38bdf8', '#a855f7', '#f43f5e', '#34d399', '#fbbf24'];

  return (
    <div
      className={cn(
        'font-display leading-relaxed tracking-wide',
        big ? 'text-[24px] sm:text-[28px]' : 'text-[16px]',
      )}
    >
      {words.map((w, i) => {
        const author = authorMap.get(w.userId);
        const color = author?.color || defaultPalette[i % defaultPalette.length];
        const isPunctuation = /^[.,!?;:'"’]+$/.test(w.word);

        return (
          <motion.span
            key={`${i}-${w.word}`}
            initial={{ scale: 0.8, opacity: 0, y: 4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className={cn('inline-block font-bold transition-all', !isPunctuation && i > 0 && 'ml-1.5')}
            style={{ color }}
            title={author ? `${author.displayName.split(' ')[0]}` : undefined}
          >
            {w.word}
          </motion.span>
        );
      })}
    </div>
  );
}
