'use client';
import type { RecapCardDTO } from '@lore/shared/dto/memories';
import { Images, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';
import { KeepsakeButton } from '@/features/keepsakes/KeepsakeButton';

export function RecapCardView({ data }: { data: RecapCardDTO }) {
  const hero = data.collageUrl ?? data.coverUrl ?? data.media[0]?.url ?? null;
  return (
    <CardShell
      icon={<Images size={20} />}
      title={data.title}
      ai={data.createdByAi}
      labels={
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px]">
            <Lock size={10} /> Private
          </span>
          {data.createdByAi && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ai-tint px-2 py-0.5 text-[11px] text-ai">
              <Sparkles size={10} /> AI-arranged
            </span>
          )}
          {data.coverAiGenerated && <span className="text-[11px] text-ai">AI illustration</span>}
        </>
      }
    >
      {hero ? (
        <img src={hero} alt="" className="mb-3 aspect-[4/5] w-full rounded-xl object-cover" />
      ) : (
        <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded-xl bg-surface-2 text-ink-2">
          <Images size={28} />
        </div>
      )}
      <p className="text-[13px]">{data.caption}</p>
      {data.musicLabel && <p className="mt-1 text-[12px] text-ink-2">vibe: {data.musicLabel}</p>}
      <p className="mt-2 text-[11px] text-ink-2">
        {data.media.length} consented items · {data.layout}
      </p>
      <KeepsakeButton recapId={data.id} />
      <Button asChild variant="secondary" size="sm" className="mt-3">
        <Link href={`/recap/${data.id}`}>Open editor</Link>
      </Button>
    </CardShell>
  );
}

export default function RecapCard({ data }: CardProps<'recap_card'>) {
  return data ? <RecapCardView data={data} /> : <CardShell title="Loading private recap…" />;
}
