'use client';
import { TopBar } from '@/components/ui/TopBar';

/** Home tab root [C1] — kept mounted by AppShell (section 9.3). Placeholder from the C1-0b scaffold. */
export function HomeScreen() {
  return (
    <div>
      <TopBar title="Home" />
      <p className="p-6 text-center text-ink-2">Home</p>
    </div>
  );
}
