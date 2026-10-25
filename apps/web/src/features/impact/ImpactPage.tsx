'use client';
import type { ImpactSummaryDTO } from '@lore/shared/dto/impact';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';

export function ImpactPage() {
  const summary = useQuery({
    queryKey: ['impact-summary'],
    queryFn: () => api.get<ImpactSummaryDTO>('/v1/impact/summary'),
    refetchInterval: 60_000,
  });
  return (
    <StackScreen>
      <TopBar title="Connection Impact" back />
      <main className="mx-auto w-full max-w-[760px] flex-1 space-y-6 px-4 pb-24 pt-5">
        <header className="rounded-2xl bg-ink p-5 text-bg">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-bg/70">
            <ShieldCheck size={15} /> Aggregate and privacy-safe
          </div>
          <h1 className="mt-2 font-display text-[28px] font-semibold">
            More time together, measured without reading conversations.
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-bg/75">
            LORE sends only event types, coarse outcomes, and one-way hashes. No message text, names, handles,
            or real IDs enter this dashboard.
          </p>
        </header>

        {summary.isLoading && <p className="py-12 text-center text-ink-2">Loading aggregate outcomes…</p>}
        {summary.isError && (
          <EmptyState
            icon={BarChart3}
            title="Impact is temporarily unavailable"
            body="The dashboard will recover from its aggregate cache automatically."
          />
        )}
        {summary.data && (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {summary.data.metrics.map((metric) => (
                <article key={metric.key} className="rounded-2xl border bg-bg p-4 hairline">
                  <p className="text-[12px] leading-tight text-ink-2">{metric.label}</p>
                  <p className="mt-2 font-display text-[26px] font-semibold tabular-nums">
                    {formatValue(metric.value)}
                    {metric.unit === '%' ? '%' : ''}
                  </p>
                  {metric.unit && metric.unit !== '%' && (
                    <p className="text-[11px] text-ink-2">{metric.unit}</p>
                  )}
                </article>
              ))}
            </section>
            <section className="grid gap-4 md:grid-cols-2">
              {summary.data.series.map((series) => (
                <MiniBars key={series.key} series={series} />
              ))}
            </section>
            {summary.data.pulse && (
              <blockquote className="rounded-2xl bg-ai-tint p-5 text-[15px] leading-relaxed text-ink">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ai">
                  Aggregate pulse
                </span>
                {summary.data.pulse}
              </blockquote>
            )}
            <footer className="flex items-center justify-between text-[11px] text-ink-2">
              <span>Updated {new Date(summary.data.updatedAt).toLocaleString()}</span>
              <span>
                {summary.data.source === 'snowflake'
                  ? 'Live aggregates'
                  : summary.data.source === 'cache'
                    ? 'Cached aggregates'
                    : 'Local demo aggregates'}
              </span>
            </footer>
          </>
        )}
      </main>
    </StackScreen>
  );
}

function formatValue(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function MiniBars({ series }: { series: ImpactSummaryDTO['series'][number] }) {
  const max = Math.max(1, ...series.points.map((point) => point.v));
  return (
    <article className="rounded-2xl border bg-bg p-4 hairline">
      <h2 className="font-semibold">{series.label}</h2>
      <div className="mt-4 flex h-28 items-end gap-2" aria-label={series.label}>
        {series.points.length ? (
          series.points.map((point) => (
            <div key={point.t} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-ink-2">{point.v}</span>
              <span
                className="w-full rounded-t bg-action"
                style={{ height: `${Math.max(4, (point.v / max) * 80)}px` }}
              />
              <span className="max-w-full truncate text-[9px] text-ink-3">{point.t.slice(5)}</span>
            </div>
          ))
        ) : (
          <p className="m-auto text-[12px] text-ink-2">No outcomes recorded yet</p>
        )}
      </div>
    </article>
  );
}
