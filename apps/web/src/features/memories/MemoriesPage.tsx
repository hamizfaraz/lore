'use client';
import type { RecapCardDTO, RecapListDTO } from '@lore/shared/dto/memories';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Images, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { RecapCardView } from './cards/RecapCard';

export function MemoriesPage({ conversationId }: { conversationId: string }) {
  const client = useQueryClient();
  const key = ['recaps', conversationId] as const;
  const recaps = useQuery({
    queryKey: key,
    queryFn: () => api.get<RecapListDTO>(`/v1/conversations/${conversationId}/recaps`),
  });
  const create = useMutation({
    mutationFn: () => api.post<RecapCardDTO>(`/v1/conversations/${conversationId}/recaps`, {}),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  return (
    <StackScreen>
      <TopBar title="Memories" back />
      <main className="mx-auto w-full max-w-[640px] flex-1 space-y-5 px-4 pb-24 pt-4">
        <section className="rounded-2xl bg-ai-tint p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ai text-white">
            <Sparkles size={20} />
          </span>
          <h1 className="mt-3 font-display text-[22px] font-semibold">
            Turn shared moments into a private recap
          </h1>
          <p className="mt-1 text-[12px] text-ink-2">
            Only consented group media is used. Nothing is published until the group’s approval workflow says
            so.
          </p>
          <Button
            variant="ai"
            block
            className="mt-3"
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Create from recent moments
          </Button>
          {create.error && <p className="mt-2 text-[12px] text-heart">{create.error.message}</p>}
        </section>
        {recaps.isLoading && <p className="py-10 text-center text-ink-2">Finding shared moments…</p>}
        {recaps.data?.recaps.map((recap) => (
          <RecapCardView key={recap.id} data={recap} />
        ))}
        {recaps.data && !recaps.data.recaps.length && (
          <EmptyState
            icon={Images}
            title="No private recaps yet"
            body="After your group shares three nearby photos, LORE can offer a grounded recap."
          />
        )}
      </main>
    </StackScreen>
  );
}
