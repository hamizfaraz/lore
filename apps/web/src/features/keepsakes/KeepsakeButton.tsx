'use client';
import type { KeepsakeDTO } from '@lore/shared/dto/keepsakes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { clientFlags } from '@/lib/flags';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';

/**
 * "Make it a keepsake" for a saved recap (section 8.15).
 * Computer 2 renders this on the recap card and the recap editor.
 * Hidden unless NEXT_PUBLIC_FEATURE_KEEPSAKES=1.
 */
export function KeepsakeButton({ recapId }: { recapId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: qk.keepsake(recapId),
    queryFn: () => api.get<{ keepsake: KeepsakeDTO | null }>(`/v1/keepsakes/by-recap/${recapId}`),
    enabled: clientFlags.keepsakes,
    refetchInterval: (query) => (query.state.data?.keepsake?.status === 'pending' ? 3000 : false),
  });
  if (!clientFlags.keepsakes) return null;

  const k = q.data?.keepsake;
  const make = async () => {
    setBusy(true);
    try {
      const next = await api.post<KeepsakeDTO>('/v1/keepsakes', { recapId });
      qc.setQueryData(qk.keepsake(recapId), { keepsake: next });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (k?.status === 'minted' && k.explorerUrl) {
    return (
      <a
        href={k.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-action"
      >
        Keepsake on Solana devnet
      </a>
    );
  }
  if (k?.status === 'pending') {
    return <p className="text-[13px] text-ink-2">Minting a keepsake on Solana devnet…</p>;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      {k?.status === 'failed' && (
        <p className="text-[13px] text-ink-2">Minting didn't go through. The recap is still saved.</p>
      )}
      <Button size="sm" variant="secondary" className="min-h-[44px]" loading={busy} onClick={make}>
        {k?.status === 'failed' ? 'Try the keepsake again' : 'Make it a keepsake'}
      </Button>
    </div>
  );
}
