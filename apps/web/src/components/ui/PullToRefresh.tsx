'use client';
import { useDrag } from '@use-gesture/react';
import { useState } from 'react';

/** Pull to refresh on Home, Inbox, Profile, Notifications (section 9.3). */
export function PullToRefresh({
  onRefresh,
  children,
}: { onRefresh: () => Promise<unknown>; children: React.ReactNode }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const bind = useDrag(
    ({ movement: [, my], last, cancel, event }) => {
      const scroller = (event.target as HTMLElement)?.closest('[data-scroll]') as HTMLElement | null;
      const top = scroller ? scroller.scrollTop : window.scrollY;
      if (top > 0 || busy) return cancel();
      if (last) {
        if (my > 70) {
          setBusy(true);
          setPull(48);
          onRefresh().finally(() => {
            setBusy(false);
            setPull(0);
          });
        } else setPull(0);
      } else setPull(Math.max(0, Math.min(90, my * 0.5)));
    },
    { axis: 'y', filterTaps: true, pointer: { touch: true } },
  );
  return (
    <div {...bind()} style={{ touchAction: 'pan-x pan-y' }}>
      <div
        className="flex items-end justify-center overflow-hidden transition-[height]"
        style={{ height: pull }}
      >
        <span
          className={`mb-3 h-5 w-5 rounded-full border-2 border-ink-2 border-t-transparent ${busy ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${pull * 4}deg)` }}
        />
      </div>
      {children}
    </div>
  );
}
