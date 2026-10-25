'use client';
import type { FamilyStoryDetailDTO } from '@lore/shared/dto/family';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BookHeart, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { ApiError, api } from '@/lib/api';
const stateLabel = (state: FamilyStoryDetailDTO['state']) => state.replaceAll('_', ' ');

export function FamilyStoryPage({ id }: { id: string }) {
  const [storyId, setStoryId] = useState(id);
  const [from, setFrom] = useState('2026-10-01');
  const [to, setTo] = useState('2026-10-31');
  const [expandedSources, setExpandedSources] = useState(true);
  const [message, setMessage] = useState('');
  const story = useQuery({
    queryKey: ['family-story', storyId],
    queryFn: () => api.get<FamilyStoryDetailDTO>(`/v1/family-stories/${storyId}`),
    retry: false,
  });
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: { id: string } }>('/v1/me'),
  });
  const isMissing = story.error instanceof ApiError && story.error.status === 404;
  const viewer = me.data?.user.id ?? '';

  const create = useMutation({
    mutationFn: () =>
      api.post<FamilyStoryDetailDTO>(`/v1/conversations/${id}/family-stories`, {
        from: `${from}T00:00:00.000Z`,
        to: `${to}T23:59:59.999Z`,
      }),
    onSuccess: (created) => {
      setStoryId(created.id);
      story.refetch();
    },
  });
  const generate = useMutation({
    mutationFn: () => api.post<FamilyStoryDetailDTO>(`/v1/family-stories/${storyId}/generate`),
    onSuccess: () => story.refetch(),
  });
  const updateSource = useMutation({
    mutationFn: (input: { sourceMessageId: string; include: boolean }) =>
      api.patch<FamilyStoryDetailDTO>(`/v1/family-stories/${storyId}/sources/${input.sourceMessageId}`, {
        include: input.include,
      }),
    onSuccess: () => story.refetch(),
  });
  const resolve = useMutation({
    mutationFn: (input: { sourceMessageId: string; correction: string }) =>
      api.patch<FamilyStoryDetailDTO>(`/v1/family-stories/${storyId}/sources/${input.sourceMessageId}`, {
        correction: input.correction,
      }),
    onSuccess: () => story.refetch(),
  });
  const share = useMutation({
    mutationFn: () => api.post(`/v1/family-stories/${storyId}/share`, { target: 'private' }),
    onSuccess: () => {
      setMessage('Shared privately with the family.');
      story.refetch();
    },
  });
  const error = useMemo(
    () => [create.error, generate.error, updateSource.error, resolve.error, share.error].find(Boolean),
    [create.error, generate.error, updateSource.error, resolve.error, share.error],
  );

  if (story.isLoading) {
    return (
      <StackScreen>
        <TopBar title="Family story" back />
        <p className="p-8 text-center text-ink-2">Opening the archive…</p>
      </StackScreen>
    );
  }
  if (isMissing) {
    return (
      <StackScreen>
        <TopBar title="Family story" back />
        <main className="mx-auto w-full max-w-[640px] space-y-5 p-5">
          <section className="rounded-3xl bg-ai-tint p-6 text-center">
            <BookHeart className="mx-auto text-ai" size={36} />
            <h1 className="mt-3 font-display text-2xl font-semibold">Turn consented history into a story</h1>
            <p className="mt-2 text-sm text-ink-2">
              Only opted-in members and the dates you choose are included. The result stays private.
            </p>
          </section>
          <section className="rounded-2xl bg-surface-2 p-4">
            <label htmlFor="family-from" className="block text-xs font-semibold text-ink-2">
              FROM
            </label>
            <input
              id="family-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-xl border bg-bg p-3 hairline"
            />
            <label htmlFor="family-to" className="mt-3 block text-xs font-semibold text-ink-2">
              TO
            </label>
            <input
              id="family-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-xl border bg-bg p-3 hairline"
            />
          </section>
          <Button block size="lg" variant="ai" loading={create.isPending} onClick={() => create.mutate()}>
            Review source material
          </Button>
          {create.error && (
            <p role="alert" className="text-center text-sm text-heart">
              {create.error.message}
            </p>
          )}
        </main>
      </StackScreen>
    );
  }
  const data = story.data;
  if (!data)
    return (
      <StackScreen>
        <TopBar title="Family story" back />
        <p className="p-8 text-center text-heart">Could not open this story.</p>
      </StackScreen>
    );

  return (
    <StackScreen>
      <TopBar title="Family story" back />
      <main className="mx-auto w-full max-w-[640px] space-y-5 p-4 pb-16">
        <header className="rounded-3xl bg-ai-tint p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-ai px-2.5 py-1 text-[11px] font-semibold text-white">
              Generated with AI
            </span>
            <span className="text-xs capitalize text-ink-2">{stateLabel(data.state)}</span>
          </div>
          <h1 className="mt-4 font-display text-[28px] font-semibold leading-tight">{data.title}</h1>
          <p className="mt-1 text-sm text-ink-2">{data.periodLabel}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-ink-2">
            <ShieldCheck size={16} /> Private by default · {data.contributors.length} contributors
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl bg-surface-2">
          <button
            type="button"
            onClick={() => setExpandedSources((value) => !value)}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Source review</span>
              <span className="text-xs text-ink-2">
                {data.sources.filter((source) => source.include).length} of {data.sources.length} included
              </span>
            </span>
            {expandedSources ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {expandedSources &&
            data.sources.map((source) => (
              <div key={source.sourceMessageId} className="border-t p-4 hairline">
                <div className="flex gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Include source from ${source.contributorName}`}
                    checked={source.include}
                    disabled={source.contributorUserId !== viewer || updateSource.isPending}
                    onChange={(event) =>
                      updateSource.mutate({
                        sourceMessageId: source.sourceMessageId,
                        include: event.target.checked,
                      })
                    }
                    className="mt-1 h-5 w-5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{source.contributorName}</p>
                    <p className="mt-1 text-sm">{source.text}</p>
                    {source.contributorUserId !== viewer && (
                      <p className="mt-2 text-[11px] text-ink-2">
                        Only this contributor can exclude or correct it.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </section>

        {!data.chapters.length && (
          <Button
            block
            variant="ai"
            size="lg"
            disabled={!data.canGenerate}
            loading={generate.isPending}
            onClick={() => generate.mutate()}
          >
            <Sparkles size={18} /> Generate private draft
          </Button>
        )}
        {data.flags.length > 0 && (
          <section className="rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/25 dark:text-amber-100">
            <h2 className="font-semibold">Needs contributor review</h2>
            {data.flags.map((flag) => {
              const source = data.sources.find((item) => item.sourceMessageId === flag.sourceMessageId);
              return (
                <div key={flag.sourceMessageId} className="mt-3">
                  <p className="text-xs capitalize">
                    {flag.issue.replaceAll('_', ' ')} · {source?.contributorName}
                  </p>
                  {source?.contributorUserId === viewer && (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        resolve.mutate({
                          sourceMessageId: flag.sourceMessageId,
                          correction: source.text.replace(
                            /check the year/i,
                            'The family is confirming the year',
                          ),
                        })
                      }
                    >
                      Add clarification
                    </Button>
                  )}
                </div>
              );
            })}
          </section>
        )}
        {data.chapters.map((chapter) => (
          <article key={chapter.heading} className="rounded-2xl bg-surface-2 p-5">
            <h2 className="font-display text-xl font-semibold">{chapter.heading}</h2>
            <p className="mt-2 text-sm text-ink-2">{chapter.summary}</p>
            <div className="mt-4 space-y-3">
              {chapter.items.map((item) => (
                <blockquote key={item.sourceMessageId} className="border-l-2 border-ai pl-3">
                  <p>{item.text}</p>
                  <footer className="mt-1 text-[11px] text-ink-2">
                    Source: {item.contributorName} · {item.sourceMessageId.slice(-6)}
                  </footer>
                </blockquote>
              ))}
            </div>
          </article>
        ))}
        {data.chapters.length > 0 && (
          <Button block size="lg" disabled={!data.canShare || share.isPending} onClick={() => share.mutate()}>
            <CheckCircle2 size={18} /> {data.canShare ? 'Share privately' : 'Resolve flags to share'}
          </Button>
        )}
        {message && <p className="text-center text-sm text-verified">{message}</p>}
        {error && (
          <p role="alert" className="text-center text-sm text-heart">
            {error.message}
          </p>
        )}
        <p className="text-center text-[11px] text-ink-2">
          AI assistant · Generated with AI · Why? Every passage links to its original source.
        </p>
      </main>
    </StackScreen>
  );
}
