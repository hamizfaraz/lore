'use client';
import type { GraphImportResultDTO } from '@lore/shared/dto/graph';
import type { MeDTO } from '@lore/shared/dto/users';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Globe, Lock } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { InterestsStep } from '@/features/discovery/InterestsStep';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import { uploadFile } from '@/lib/upload';

type Step = 'handle' | 'avatar' | 'visibility' | 'interests';

/** Onboarding: handle → avatar (upload or Facebook picture) → visibility → interests (C2 component). */
export function OnboardingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const me = useMe();
  const [step, setStep] = useState<Step>('handle');
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [avatar, setAvatar] = useState<{ id: string | null; url: string | null }>({ id: null, url: null });
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [busy, setBusy] = useState(false);
  const [graph, setGraph] = useState<GraphImportResultDTO | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/login');
    if (me.data?.personalAccount && !handle) {
      setHandle(me.data.personalAccount.handle);
      setName(me.data.personalAccount.displayName);
      setAvatar({ id: null, url: me.data.personalAccount.avatarUrl });
    }
  }, [me.data, me.error, handle, router]);

  // After Facebook login, import likes/friends once (C1-10 endpoint; failures are non-blocking).
  useEffect(() => {
    if (params.get('fb') !== '1') return;
    api
      .post<GraphImportResultDTO>('/v1/graph/import', {})
      .then((r) => {
        setGraph(r);
        setPicked(r.suggestedTags.map((t) => t.tag));
        qc.invalidateQueries({ queryKey: qk.me });
      })
      .catch(() => {});
  }, [params, qc]);

  useEffect(() => {
    if (!handle || handle === me.data?.personalAccount?.handle) return setAvailable(null);
    const t = setTimeout(() => {
      api
        .get<{ available: boolean }>(`/v1/handles/${encodeURIComponent(handle)}/available`)
        .then((r) => setAvailable(r.available))
        .catch(() => setAvailable(null));
    }, 300);
    return () => clearTimeout(t);
  }, [handle, me.data]);

  const save = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api.patch('/v1/me/profile', body);
      await qc.invalidateQueries({ queryKey: qk.me });
      return true;
    } catch (e) {
      toast((e as Error).message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (graph && picked) {
      await api.post('/v1/graph/suggestions', { tags: picked }).catch(() => {});
    }
    if (await save({ onboarded: true })) {
      const data = qc.getQueryData<MeDTO>(qk.me);
      if (data) qc.setQueryData(qk.me, { ...data, onboarded: true });
      router.replace('/');
    }
  };

  if (!me.data) return <div className="py-20 text-center text-ink-2">Loading…</div>;

  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <div className="flex gap-1.5" aria-hidden>
        {(['handle', 'avatar', 'visibility', 'interests'] as Step[]).map((s) => (
          <span key={s} className={cn('h-1 w-8 rounded-full', s === step ? 'bg-ink' : 'bg-line')} />
        ))}
      </div>

      {step === 'handle' && (
        <>
          <h1 className="text-[22px] font-bold">Choose your username</h1>
          <p className="text-ink-2">You can always change it later.</p>
          <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={60} />
          <Field
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
            placeholder="Username"
            maxLength={30}
            autoCapitalize="off"
            error={available === false ? 'That username is taken' : undefined}
          />
          <Button
            block
            size="lg"
            loading={busy}
            disabled={handle.length < 2 || available === false || !name.trim()}
            onClick={async () => (await save({ handle, displayName: name.trim() })) && setStep('avatar')}
          >
            Next
          </Button>
        </>
      )}

      {step === 'avatar' && (
        <>
          <h1 className="text-[22px] font-bold">Add a profile photo</h1>
          <p className="text-ink-2">Add a photo so your friends know it's you.</p>
          <button type="button" onClick={() => file.current?.click()} className="press relative">
            <Avatar src={avatar.url} name={name} size={140} />
            <span className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-bg bg-action text-white">
              <Camera size={18} />
            </span>
          </button>
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try {
                const m = await uploadFile(f, 'image');
                setAvatar({ id: m.id, url: m.thumbUrl ?? m.url });
              } catch (err) {
                toast((err as Error).message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            block
            size="lg"
            loading={busy}
            onClick={async () =>
              (avatar.id ? await save({ avatarMediaId: avatar.id }) : true) && setStep('visibility')
            }
          >
            {avatar.url ? 'Next' : 'Skip'}
          </Button>
        </>
      )}

      {step === 'visibility' && (
        <>
          <h1 className="text-[22px] font-bold">Who can see your posts?</h1>
          <div className="w-full space-y-2 text-left">
            {(
              [
                ['public', Globe, 'Public', 'Anyone can see your posts and follow you.'],
                ['private', Lock, 'Private', 'Only followers you approve can see your posts.'],
              ] as const
            ).map(([v, I, t, d]) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={cn(
                  'press flex w-full items-center gap-3 rounded-xl border p-3',
                  visibility === v ? 'border-ink' : 'border-line',
                )}
              >
                <I size={22} />
                <span className="flex-1">
                  <span className="block font-semibold">{t}</span>
                  <span className="block text-[13px] text-ink-2">{d}</span>
                </span>
                <span
                  className={cn(
                    'h-5 w-5 rounded-full border-2',
                    visibility === v ? 'border-[6px] border-ink' : 'border-line',
                  )}
                />
              </button>
            ))}
          </div>
          <Button
            block
            size="lg"
            loading={busy}
            onClick={async () => (await save({ visibility })) && setStep('interests')}
          >
            Next
          </Button>
        </>
      )}

      {step === 'interests' && (
        <>
          <h1 className="text-[22px] font-bold">What are you into?</h1>
          {graph?.suggestedTags.length ? (
            <div className="flex w-full flex-wrap justify-center gap-2">
              {graph.suggestedTags.map((t) => {
                const on = (picked ?? graph.suggestedTags.map((s) => s.tag)).includes(t.tag);
                return (
                  <button
                    key={t.tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setPicked((cur) => {
                        const base = cur ?? graph.suggestedTags.map((s) => s.tag);
                        return base.includes(t.tag) ? base.filter((x) => x !== t.tag) : [...base, t.tag];
                      })
                    }
                    className={cn(
                      'min-h-[44px] rounded-full border px-3 py-1.5 text-[13px]',
                      on ? 'border-ink bg-surface-2' : 'border-line text-ink-2 line-through',
                    )}
                  >
                    {t.tag} <span className="text-ink-2">from Facebook</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {(graph?.friendsOnLore.length ?? 0) > 0 && (
            <p className="text-[14px] text-ink-2">
              {graph!.friendsOnLore.length === 1
                ? '1 friend is on LORE'
                : `${graph!.friendsOnLore.length} friends are on LORE`}
              . You'll find them under Friends on LORE.
            </p>
          )}
          <InterestsStep onDone={finish} suggestedTags={graph?.suggestedTags} />
          <Button block size="lg" variant="secondary" loading={busy} onClick={finish}>
            Finish
          </Button>
        </>
      )}
    </div>
  );
}
