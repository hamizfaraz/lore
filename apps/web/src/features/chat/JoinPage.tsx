'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AvatarStack } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { api } from '@/lib/api';
import { toast } from '@/lib/store';

/** /join/[slug] [C1]: judges scan a QR and join the group as a 2-hour guest (section 15). */
export function JoinPage({ slug }: { slug: string }) {
  return (
    <Suspense>
      <Join slug={slug} />
    </Suspense>
  );
}

function Join({ slug }: { slug: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const code = useSearchParams().get('code') ?? '';
  const info = useQuery({
    queryKey: ['join', slug],
    queryFn: () =>
      api.get<{ title: string; memberCount: number; avatars: (string | null)[] }>(`/v1/join/${slug}`),
    retry: false,
  });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const join = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ conversationId: string }>(`/v1/join/${slug}`, {
        code,
        name: name || undefined,
      });
      await qc.invalidateQueries();
      router.replace(`/c/${r.conversationId}`);
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-[350px] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="wordmark text-[40px]">lore</span>
      {info.data ? (
        <>
          <AvatarStack srcs={info.data.avatars} size={80} />
          <h1 className="text-[22px] font-bold">Join {info.data.title}</h1>
          <p className="text-ink-2">{info.data.memberCount} members · guest access for 2 hours</p>
          <Field
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            maxLength={40}
          />
          <Button block size="lg" loading={busy} onClick={join}>
            Join chat
          </Button>
          <p className="text-[12px] text-ink-2">
            The group's AI member, Milo, may read and reply to your messages. Guest messages are deleted when
            access ends.
          </p>
        </>
      ) : info.error ? (
        <p className="text-ink-2">This invite link is invalid or expired.</p>
      ) : (
        <p className="text-ink-2">Loading…</p>
      )}
    </main>
  );
}
