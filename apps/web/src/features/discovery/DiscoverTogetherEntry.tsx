'use client';
import Link from 'next/link';
import { Compass } from 'lucide-react';

/** "Discover Together" Explore tile [C2]. Stub from the scaffold. */
export function DiscoverTogetherEntry() {
  return (
    <Link
      href="/find-friends?tab=together"
      className="press flex flex-1 items-center gap-2 rounded-xl bg-surface-2 p-3 font-semibold"
    >
      <Compass size={22} /> Discover Together
    </Link>
  );
}
