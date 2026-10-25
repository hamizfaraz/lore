'use client';
import type { RecapCardDTO } from '@lore/shared/dto/memories';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Lock, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { KeepsakeButton } from '@/features/keepsakes/KeepsakeButton';
import { api } from '@/lib/api';

export function RecapEditorPage({ id }: { id: string }) {
  const client = useQueryClient();
  const key = ['recap', id] as const;
  const recap = useQuery({ queryKey: key, queryFn: () => api.get<RecapCardDTO>(`/v1/recaps/${id}`) });
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [layout, setLayout] = useState<'grid' | 'collage' | 'carousel' | 'story'>('collage');
  const [accountId, setAccountId] = useState('');
  useEffect(() => {
    if (!recap.data) return;
    setTitle(recap.data.title);
    setCaption(recap.data.caption);
    setLayout(recap.data.layout);
  }, [recap.data]);
  const update = (next: RecapCardDTO) => client.setQueryData(key, next);
  const save = useMutation({
    mutationFn: () => api.patch<RecapCardDTO>(`/v1/recaps/${id}`, { title, caption, layout }),
    onSuccess: update,
  });
  const action = useMutation({
    mutationFn: async (kind: 'save' | 'share' | 'cover' | 'propose') => {
      if (kind === 'save') return api.post<RecapCardDTO>(`/v1/recaps/${id}/save`);
      if (kind === 'share') return api.post<RecapCardDTO>(`/v1/recaps/${id}/share`, { target: 'chat' });
      if (kind === 'cover') return api.patch<RecapCardDTO>(`/v1/recaps/${id}`, { regenerateCover: true });
      if (!accountId.trim()) throw new Error('Enter the group account id first.');
      await api.post(`/v1/recaps/${id}/propose-post`, { accountId, caption });
      return api.get<RecapCardDTO>(`/v1/recaps/${id}`);
    },
    onSuccess: update,
  });
  const removeMedia = useMutation({
    mutationFn: (mediaId: string) =>
      api.post<RecapCardDTO>(`/v1/recaps/${id}/consent`, { mediaId, include: false }),
    onSuccess: update,
  });
  if (!recap.data)
    return (
      <StackScreen>
        <TopBar title="Recap" back />
        <p className="p-8 text-center text-ink-2">Loading private recap…</p>
      </StackScreen>
    );

  return (
    <StackScreen>
      <TopBar
        title="Recap editor"
        back
        right={
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-2">
            <Lock size={12} /> Private
          </span>
        }
      />
      <main className="mx-auto w-full max-w-[640px] flex-1 space-y-5 px-4 pb-28 pt-4">
        <section className="space-y-3 rounded-2xl bg-surface-2 p-4">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border bg-bg px-3 py-2 hairline"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold">Caption</span>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              className="min-h-24 w-full rounded-xl border bg-bg p-3 hairline"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold">Layout</span>
            <select
              value={layout}
              onChange={(event) => setLayout(event.target.value as typeof layout)}
              className="w-full rounded-xl border bg-bg px-3 py-2 hairline"
            >
              <option value="grid">Grid</option>
              <option value="collage">Collage</option>
              <option value="carousel">Carousel</option>
              <option value="story">Story</option>
            </select>
          </label>
          <Button block loading={save.isPending} onClick={() => save.mutate()}>
            Save edits
          </Button>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Included media</h2>
          <div className="space-y-2">
            {recap.data.media.map((media) => (
              <div key={media.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2">
                <GripVertical size={18} className="text-ink-2" />
                <img
                  src={media.thumbUrl ?? media.url}
                  alt={media.altText ?? ''}
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-[12px]">{media.altText ?? 'Shared image'}</span>
                <button
                  type="button"
                  aria-label="Remove and revoke this media"
                  onClick={() => removeMedia.mutate(media.id)}
                >
                  <Trash2 size={18} className="text-heart" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border p-4 hairline">
          <h2 className="font-semibold">Share when you are ready</h2>
          <p className="text-[12px] text-ink-2">
            Saving stays private. A group-account post always enters the normal approval workflow.
          </p>
          <Button variant="secondary" block onClick={() => action.mutate('save')}>
            Save privately
          </Button>
          <KeepsakeButton recapId={id} />
          <Button variant="secondary" block onClick={() => action.mutate('share')}>
            Share recap card to chat
          </Button>
          <Button variant="ai" block onClick={() => action.mutate('cover')}>
            <Sparkles size={15} /> Regenerate AI illustration
          </Button>
          <input
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            placeholder="Group account id"
            className="w-full rounded-xl border bg-bg px-3 py-2 hairline"
          />
          <Button block onClick={() => action.mutate('propose')}>
            Propose group post
          </Button>
          {action.error && <p className="text-[12px] text-heart">{action.error.message}</p>}
        </section>
      </main>
    </StackScreen>
  );
}
