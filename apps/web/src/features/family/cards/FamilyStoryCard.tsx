'use client';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

export default function FamilyStoryCard({ data }: CardProps<'family_story_card'>) {
  if (!data) return <CardShell title="Family story">Loading…</CardShell>;
  return (
    <CardShell icon={<BookOpen size={18} />} title={data.title} ai>
      <p className="text-[13px] text-ink-2">{data.periodLabel || 'Family story'}</p>
      <p className="mt-2 text-[12px] text-ink-2">
        {data.chapterCount} chapters
        {data.flagsOpen ? ` · ${data.flagsOpen} open flags` : ''}
      </p>
      <Link href={`/family/${data.id}`} className="mt-3 inline-block text-[13px] font-semibold text-action">
        Open story
      </Link>
    </CardShell>
  );
}
