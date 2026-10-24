'use client';
import { TopBar } from '@/components/ui/TopBar';

/** Search tab root [C1] — kept mounted by AppShell (section 9.3). Placeholder from the C1-0b scaffold. */
export function ExploreScreen() {
  return (
    <div>
      <TopBar title="Search" />
      <p className="p-6 text-center text-ink-2">Search</p>
    </div>
  );
}
