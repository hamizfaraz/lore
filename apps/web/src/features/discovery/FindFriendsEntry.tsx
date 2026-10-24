'use client';
import Link from 'next/link';
import { Users } from 'lucide-react';

/** "Find Friends" row at the top of search results / Explore entry tile [C2]. Stub from the scaffold. */
export function FindFriendsEntry({ variant = 'row' }: { variant?: 'row' | 'tile' }) {
  return (
    <Link
      href="/find-friends"
      className={
        variant === 'tile'
          ? 'press flex flex-1 items-center gap-2 rounded-xl bg-surface-2 p-3 font-semibold'
          : 'press flex items-center gap-3 px-4 py-2'
      }
    >
      <Users size={22} /> Find Friends
    </Link>
  );
}
