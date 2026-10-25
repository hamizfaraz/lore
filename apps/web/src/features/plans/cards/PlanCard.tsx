'use client';
import type { PlanCardDTO } from '@lore/shared/dto/plans';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

export function PlanCardView({
  data,
  onVote,
  onRefine,
  onConfirm,
  busy,
}: {
  data: PlanCardDTO;
  onVote?: (candidateId: string, response: 'yes' | 'flexible' | 'no' | 'veto') => void;
  onRefine?: (instruction: string) => void;
  onConfirm?: (candidateId: string, startsAt: string) => void;
  busy?: boolean;
}) {
  const [selected, setSelected] = useState(data.options[0]?.candidateId ?? '');
  const [when, setWhen] = useState(() => {
    const date = new Date(Date.now() + 86_400_000);
    date.setHours(18, 0, 0, 0);
    return date.toISOString().slice(0, 16);
  });
  return (
    <CardShell
      icon={<CalendarCheck size={20} />}
      title={data.header}
      ai={data.createdBy === 'ai'}
      labels={
        <>
          <span className="rounded-full bg-ai-tint px-2 py-0.5 text-[11px] text-ai">Fair-fit ranking</span>
          {data.degraded && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px]">Fallback data</span>
          )}
        </>
      }
    >
      {data.evidence && <p className="mb-2 text-[12px] text-ink-2">{data.evidence}</p>}
      {data.noFeasibleOption && (
        <div className="rounded-xl bg-surface-2 p-3 text-[13px]">
          {data.askToRelax ?? 'No option fits every hard constraint.'}
        </div>
      )}
      <div className="flex snap-x gap-2 overflow-x-auto pb-2">
        {data.options.map((option) => (
          <article
            key={option.candidateId}
            className={cn(
              'min-w-[250px] snap-center rounded-xl border p-3 hairline',
              selected === option.candidateId && 'border-action',
            )}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => setSelected(option.candidateId)}
            >
              <p className="font-semibold">{option.headline}</p>
              <p className="mt-1 text-[12px] text-ink-2">{option.why}</p>
            </button>
            <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-ink-2">
              {option.priceText && <span>{option.priceText}</span>}
              {option.priceUnverified && <span>Price unverified</span>}
              {option.travelText && <span>· {option.travelText}</span>}
              {option.sourceUrl && (
                <a
                  className="inline-flex items-center gap-0.5 text-action"
                  href={option.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {option.sourceDomain} <ExternalLink size={10} />
                </a>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1">
              {option.fitByMember.map((fit) => (
                <span
                  key={fit.userId}
                  title={fit.fit}
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    fit.fit === 'great' ? 'bg-verified' : fit.fit === 'ok' ? 'bg-action' : 'bg-heart',
                  )}
                />
              ))}
              <span className="ml-1 text-[11px] text-ink-2">
                {option.tally.yes} yes · {option.tally.flexible} flexible · {option.tally.veto} veto
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1">
              {(['yes', 'flexible', 'no', 'veto'] as const).map((response) => (
                <button
                  key={response}
                  type="button"
                  disabled={busy}
                  onClick={() => onVote?.(option.candidateId, response)}
                  className={cn(
                    'press rounded-lg bg-surface-2 px-1 py-1.5 text-[11px] capitalize',
                    option.myResponse === response && 'bg-action text-white',
                  )}
                >
                  {response}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      {data.compromiseNote && (
        <p className="mt-1 flex gap-1 text-[11px] text-ink-2">
          <ShieldCheck size={14} />
          {data.compromiseNote}
        </p>
      )}
      {data.options.length > 0 && (
        <div className="mt-3 space-y-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            className="w-full rounded-lg border bg-bg px-2 py-2 hairline"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRefine?.('give us a different balance')}
              disabled={busy}
            >
              <RefreshCw size={14} /> Refine
            </Button>
            <Button
              size="sm"
              onClick={() => onConfirm?.(selected, new Date(when).toISOString())}
              disabled={busy || !selected}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
    </CardShell>
  );
}

export default function PlanCard({ data, conversationId }: CardProps<'plan_card'>) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (
      action:
        | { kind: 'vote'; candidateId: string; response: 'yes' | 'flexible' | 'no' | 'veto' }
        | { kind: 'refine'; instruction: string }
        | { kind: 'confirm'; candidateId: string; startsAt: string },
    ) => {
      if (!data) return null;
      if (action.kind === 'vote') return api.post(`/v1/plans/${data.id}/votes`, action);
      if (action.kind === 'refine') return api.post(`/v1/plans/${data.id}/refine`, action);
      return api.post(`/v1/plans/${data.id}/confirm`, {
        ...action,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['plans', conversationId] }),
  });
  if (!data) return <CardShell title="Loading plan…" />;
  return (
    <PlanCardView
      data={data}
      busy={mutation.isPending}
      onVote={(candidateId, response) => mutation.mutate({ kind: 'vote', candidateId, response })}
      onRefine={(instruction) => mutation.mutate({ kind: 'refine', instruction })}
      onConfirm={(candidateId, startsAt) => mutation.mutate({ kind: 'confirm', candidateId, startsAt })}
    />
  );
}
