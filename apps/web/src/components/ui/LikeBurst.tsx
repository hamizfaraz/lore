'use client';
import { Heart } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

/** Double-tap heart burst over media. */
export function LikeBurst({ show }: { show: number }) {
  return (
    <AnimatePresence>
      {show > 0 && (
        <motion.span
          key={show}
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-white drop-shadow-lg"
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.2, 1], opacity: [0, 1, 1] }}
          exit={{ scale: 1.3, opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Heart size={96} fill="currentColor" strokeWidth={0} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
