'use client';
import { Sparkles } from 'lucide-react';
import { CardShell } from '@/components/ui/CardShell';
import { AiPill } from '@/components/ui/Labels';
import type { CardProps } from '@/features/chat/cards/types';

export default function AiImageCard({ message, data }: CardProps<'ai_image'>) {
  return (
    <CardShell
      icon={<Sparkles size={18} />}
      title="A little something"
      labels={<AiPill label="AI illustration" />}
      ai
    >
      {data ? (
        <figure className="overflow-hidden rounded-xl">
          <img
            src={data.imageUrl}
            alt={data.caption ?? 'AI-generated illustration'}
            className="aspect-square w-full object-cover"
          />
          {(data.caption ?? message.body) && (
            <figcaption className="bg-surface-2 px-3 py-2 text-[13px]">
              {data.caption ?? message.body}
            </figcaption>
          )}
        </figure>
      ) : (
        <p className="text-[13px] text-ink-2">{message.body ?? 'Illustration unavailable.'}</p>
      )}
    </CardShell>
  );
}
