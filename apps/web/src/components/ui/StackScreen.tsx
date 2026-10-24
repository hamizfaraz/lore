'use client';
import { useDrag } from '@use-gesture/react';
import { motion, useAnimationControls } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/cn';

/**
 * A pushed screen (StackNavigator, section 9.3): slides in from the right (300 ms, iOS curve),
 * edge-swipe from the left 24 px goes back. The tab root underneath stays mounted.
 */
export function StackScreen({
  children,
  className,
  onBack,
  modal,
}: { children: React.ReactNode; className?: string; onBack?: () => void; modal?: boolean }) {
  const router = useRouter();
  const controls = useAnimationControls();
  const back = onBack ?? (() => router.back());

  useEffect(() => {
    controls.start({ x: 0, y: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } });
  }, [controls]);

  const bind = useDrag(
    ({ initial: [ix], movement: [mx], last, velocity: [vx], cancel }) => {
      if (modal) return;
      if (ix > 24) return cancel();
      if (last) {
        if (mx > window.innerWidth * 0.35 || vx > 0.5) {
          controls.start({ x: window.innerWidth, transition: { duration: 0.2 } }).then(back);
        } else controls.start({ x: 0 });
      } else controls.set({ x: Math.max(0, mx) });
    },
    { axis: 'x', filterTaps: true, pointer: { touch: true } },
  );

  return (
    <motion.div
      {...(bind() as any)}
      initial={modal ? { y: '100%' } : { x: '100%' }}
      animate={controls}
      className={cn(
        'fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg md:static md:z-auto md:min-h-dvh md:transform-none',
        className,
      )}
      style={{ touchAction: 'pan-y' }}
    >
      {children}
    </motion.div>
  );
}

/** Full-screen modal that slides up (Create, game screen). */
export function ModalScreen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className={cn('fixed inset-0 z-50 flex flex-col bg-bg', className)}
    >
      {children}
    </motion.div>
  );
}
