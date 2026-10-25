'use client';
import type { PlanConfirmedCardDTO } from '@lore/shared/dto/plans';
import { CalendarCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';

export function PlanConfirmedView({ data }: { data: PlanConfirmedCardDTO }) {
  return (
    <CardShell
      icon={<CalendarCheck size={20} />}
      title={data.title}
      labels={<span className="text-[11px] text-verified">Confirmed by {data.confirmedBy.displayName}</span>}
    >
      <p className="text-[13px]">{new Date(data.startsAt).toLocaleString()}</p>
      {data.regionLabel && <p className="mt-1 text-[12px] text-ink-2">{data.regionLabel}</p>}
      <div className="mt-3 flex flex-wrap gap-1">
        {data.rsvps.map((rsvp) => (
          <span key={rsvp.userId} className="rounded-full bg-surface-2 px-2 py-1 text-[11px]">
            {rsvp.status}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button asChild size="sm" variant="secondary">
          <a href={data.icsUrl}>Add to calendar</a>
        </Button>
        {data.placeUrl && (
          <Button asChild size="sm" variant="text">
            <a href={data.placeUrl} target="_blank" rel="noreferrer">
              Source <ExternalLink size={13} />
            </a>
          </Button>
        )}
      </div>
    </CardShell>
  );
}

export default function PlanConfirmedCard({ data }: CardProps<'plan_confirmed'>) {
  return data ? <PlanConfirmedView data={data} /> : <CardShell title="Loading confirmed plan…" />;
}
