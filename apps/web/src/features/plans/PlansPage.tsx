'use client';
import type { PlansOverviewDTO, SuggestResult } from '@lore/shared/dto/plans';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { PlanCardView } from './cards/PlanCard';
import { PlanConfirmedView } from './cards/PlanConfirmedCard';

export function PlansPage({ conversationId }: { conversationId: string }) {
  const client = useQueryClient();
  const key = ['plans', conversationId] as const;
  const [request, setRequest] = useState('Something fun together this weekend');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [budget, setBudget] = useState('30');
  const [travel, setTravel] = useState('25');
  const [visibility, setVisibility] = useState<'ai_only' | 'group'>('ai_only');
  const plans = useQuery({
    queryKey: key,
    queryFn: () => api.get<PlansOverviewDTO>(`/v1/conversations/${conversationId}/plans`),
  });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const suggest = useMutation({
    mutationFn: () =>
      api.post<SuggestResult>(`/v1/conversations/${conversationId}/plans/suggest`, { request }),
    onSuccess: refresh,
  });
  const mutate = useMutation({
    mutationFn: async (action: { id: string; kind: 'vote' | 'refine' | 'confirm'; body: object }) => {
      const path = action.kind === 'vote' ? 'votes' : action.kind;
      return api.post(`/v1/plans/${action.id}/${path}`, action.body);
    },
    onSuccess: refresh,
  });
  const savePrefs = useMutation({
    mutationFn: async () => {
      await Promise.all([
        api.put(`/v1/conversations/${conversationId}/plans/preferences`, {
          key: 'budget_max',
          value: Number(budget),
          visibility,
        }),
        api.put(`/v1/conversations/${conversationId}/plans/preferences`, {
          key: 'travel_minutes',
          value: Number(travel),
          visibility,
        }),
      ]);
    },
    onSuccess: () => {
      setPreferencesOpen(false);
      refresh();
    },
  });

  return (
    <StackScreen>
      <TopBar
        title="Plans"
        back
        right={
          <button type="button" aria-label="Plan preferences" onClick={() => setPreferencesOpen(true)}>
            <SlidersHorizontal size={20} />
          </button>
        }
      />
      <main className="mx-auto w-full max-w-[640px] flex-1 space-y-5 px-4 pb-24 pt-4">
        <section className="rounded-2xl bg-surface-2 p-4">
          <h1 className="font-display text-[22px] font-semibold">What should we do?</h1>
          <p className="mt-1 text-[12px] text-ink-2">
            LORE checks hard limits, keeps private constraints private, and never books for you.
          </p>
          <textarea
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            maxLength={280}
            className="mt-3 min-h-20 w-full rounded-xl border bg-bg p-3 outline-none hairline focus:border-action"
          />
          <Button block className="mt-2" loading={suggest.isPending} onClick={() => suggest.mutate()}>
            Find fair options
          </Button>
          {suggest.isPending && (
            <p className="mt-2 text-center text-[12px] text-ink-2">Looking across sourced options…</p>
          )}
          {suggest.error && <p className="mt-2 text-[12px] text-heart">{suggest.error.message}</p>}
        </section>

        {plans.isLoading && <p className="py-10 text-center text-ink-2">Loading plans…</p>}
        {plans.data?.confirmed.map((plan) => (
          <PlanConfirmedView key={plan.planId} data={plan} />
        ))}
        {plans.data?.proposals
          .filter((plan) => plan.status !== 'dismissed')
          .map((plan) => (
            <PlanCardView
              key={`${plan.id}:${plan.version}`}
              data={plan}
              busy={mutate.isPending}
              onVote={(candidateId, response) =>
                mutate.mutate({ id: plan.id, kind: 'vote', body: { candidateId, response } })
              }
              onRefine={(instruction) =>
                mutate.mutate({ id: plan.id, kind: 'refine', body: { instruction } })
              }
              onConfirm={(candidateId, startsAt) =>
                mutate.mutate({
                  id: plan.id,
                  kind: 'confirm',
                  body: { candidateId, startsAt, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
                })
              }
            />
          ))}
        {plans.data && !plans.data.proposals.length && !plans.data.confirmed.length && (
          <EmptyState
            icon={CalendarDays}
            title="No plans yet"
            body="Ask for an idea and everyone can vote independently."
          />
        )}
      </main>

      <Sheet
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        title="Your plan preferences"
        footer={
          <div className="border-t hairline p-4">
            <Button block loading={savePrefs.isPending} onClick={() => savePrefs.mutate()}>
              Save preferences
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-4">
          <label className="block">
            <span className="mb-1 block font-semibold">Maximum per person</span>
            <input
              type="number"
              min="0"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              className="w-full rounded-xl border bg-bg px-3 py-2 hairline"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold">Maximum travel minutes</span>
            <input
              type="number"
              min="0"
              value={travel}
              onChange={(event) => setTravel(event.target.value)}
              className="w-full rounded-xl border bg-bg px-3 py-2 hairline"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold">Who can see the details?</span>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as 'ai_only' | 'group')}
              className="w-full rounded-xl border bg-bg px-3 py-2 hairline"
            >
              <option value="ai_only">AI only — group sees only that a constraint was honored</option>
              <option value="group">Everyone in the group</option>
            </select>
          </label>
        </div>
      </Sheet>
    </StackScreen>
  );
}
