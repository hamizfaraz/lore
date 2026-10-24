'use client';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Hammer } from 'lucide-react';

/** Podcast [C2] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function PodcastPage(_props: { showId: string }) {
  return (
    <StackScreen>
      <TopBar title="Podcast" back={true} />
      <EmptyState icon={Hammer} title="Podcast" body="Coming soon." />
    </StackScreen>
  );
}
