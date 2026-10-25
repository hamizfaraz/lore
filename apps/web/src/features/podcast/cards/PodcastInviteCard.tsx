'use client';
import { Mic } from 'lucide-react';
import Link from 'next/link';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

export default function PodcastInviteCard({ data }: CardProps<'podcast_invite'>) {
  if (!data) return <CardShell title="Podcast">Loading…</CardShell>;
  return (
    <CardShell icon={<Mic size={18} />} title={data.title}>
      <p className="text-[13px] text-ink-2">{data.stationTopic ?? 'A private group show'}</p>
      <Link
        href={`/podcast/${data.showId}`}
        className="mt-3 inline-block text-[13px] font-semibold text-action"
      >
        Open show
      </Link>
    </CardShell>
  );
}
