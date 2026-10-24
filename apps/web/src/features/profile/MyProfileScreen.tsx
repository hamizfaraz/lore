'use client';
import { TopBar } from '@/components/ui/TopBar';

/** Profile tab root [C1] — kept mounted by AppShell (section 9.3). Placeholder from the C1-0b scaffold. */
export function MyProfileScreen() {
  return (
    <div>
      <TopBar title="Profile" />
      <p className="p-6 text-center text-ink-2">Profile</p>
    </div>
  );
}
