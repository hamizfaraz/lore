'use client';
import type { IntroductionDTO } from '@lore/shared/dto/discovery';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CardShell } from '@/components/ui/CardShell';
import type { CardProps } from '@/features/chat/cards/types';
import { api } from '@/lib/api';

export default function IntroCard({ data, meUserId }: CardProps<'intro_card'>) {
  const client = useQueryClient();
  const decide = useMutation({
    mutationFn: async (action: 'accept' | 'decline') => {
      if (!data) throw new Error('Introduction is still loading');
      return api.patch<IntroductionDTO>(`/v1/discovery/introductions/${data.id}`, { action });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['discovery'] }),
  });
  if (!data) return <CardShell title="Introduction">Loading…</CardShell>;
  const incoming = data.to.id === meUserId;
  const person = incoming ? data.from : data.to;
  return (
    <CardShell title={`Introduction · ${person.displayName}`}>
      <p className="text-[13px]">{data.basis.reason}</p>
      {data.firstMessage && <p className="mt-2 text-[13px] text-ink-2">“{data.firstMessage}”</p>}
      {incoming && data.state === 'requested' && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => decide.mutate('accept')}>
            Accept
          </Button>
          <Button size="sm" variant="text" onClick={() => decide.mutate('decline')}>
            Not now
          </Button>
        </div>
      )}
      {data.state === 'accepted' && data.conversationId && (
        <Link
          href={`/c/${data.conversationId}`}
          className="mt-3 inline-block text-[13px] font-semibold text-action"
        >
          Open chat
        </Link>
      )}
    </CardShell>
  );
}
