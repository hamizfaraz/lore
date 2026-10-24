'use client';
import { TopBar } from '@/components/ui/TopBar';

/** Reels tab root [C1] — kept mounted by AppShell (section 9.3). Placeholder from the C1-0b scaffold. */
export function ReelsScreen() {
  return (
    <div>
      <TopBar title="Reels" />
      <p className="p-6 text-center text-ink-2">Reels</p>
    </div>
  );
}
