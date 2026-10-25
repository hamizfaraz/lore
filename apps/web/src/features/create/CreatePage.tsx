'use client';
import type { PolicyDTO } from '@lore/shared/dto/groups';
import type { MediaDTO } from '@lore/shared/dto/media';
import type { CreatePostResult } from '@lore/shared/dto/social';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Copy, ImagePlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field, Toggle } from '@/components/ui/Field';
import { ListRow } from '@/components/ui/ListRow';
import { Sheet } from '@/components/ui/Sheet';
import { ModalScreen } from '@/components/ui/StackScreen';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/hooks';
import { maybeAskPush } from '@/lib/push';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import { readVideoDuration, uploadFile } from '@/lib/upload';
import { type Area, FILTERS, renderEdited } from './edit';

type Mode = 'post' | 'story' | 'reel';
type Item = { file: File; url: string; kind: 'image' | 'video'; area: Area | null; filter: string };
type Step = 'pick' | 'edit' | 'details';

/**
 * Create [C1]: full-screen modal; bottom mode switcher POST / STORY / REEL; picker with large preview;
 * Next → edit (filters strip, crop) → "New post": caption, alt text, location, **Post as** (you or a group
 * account), and Share / Submit for approval / Send for review per policy (section 9.2).
 */
export function CreatePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const [mode, setMode] = useState<Mode>('post');
  const [step, setStep] = useState<Step>('pick');
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const [aspect, setAspect] = useState<number>(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [caption, setCaption] = useState('');
  const [alt, setAlt] = useState('');
  const [tags, setTags] = useState('');
  const [location, setLocation] = useState('');
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [courtesyReview, setCourtesyReview] = useState(false);
  const [pickAuthor, setPickAuthor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const personal = me.data?.personalAccount;
  const accounts = useMemo(
    () => [
      ...(personal ? [{ ...personal, group: false }] : []),
      ...(me.data?.groupAccounts ?? []).map((g) => ({ ...g, group: true })),
    ],
    [personal, me.data],
  );
  const author = accounts.find((a) => a.id === (authorId ?? personal?.id)) ?? accounts[0];
  const policy = useQuery({
    queryKey: qk.policy(author?.id ?? ''),
    queryFn: () => api.get<PolicyDTO>(`/v1/accounts/${author!.id}/policy`),
    enabled: Boolean(author?.group),
  });

  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const pick = async (files: File[]) => {
    const max = mode === 'post' ? 10 : 1;
    const next: Item[] = [];
    for (const f of files.slice(0, max)) {
      const kind = f.type.startsWith('video') ? 'video' : 'image';
      if (mode === 'reel' && kind !== 'video') return toast('Reels need a video', 'error');
      if (mode !== 'reel' && kind === 'video' && mode === 'story')
        return toast('Stories support photos for now', 'error');
      if (kind === 'video') {
        if ((await readVideoDuration(f)) > 60.5) return toast('Videos are limited to 60 seconds', 'error');
        if (f.size > 50 * 1024 * 1024) return toast('Videos are limited to 50 MB', 'error');
      }
      next.push({ file: f, url: URL.createObjectURL(f), kind, area: null, filter: 'none' });
    }
    if (mode === 'post' && next.some((n) => n.kind === 'video'))
      return toast('Post videos as a reel', 'error');
    setItems(next);
    setActive(0);
  };

  const cur = items[active];
  const buttonLabel = (() => {
    if (mode === 'story') return 'Share to story';
    if (!author?.group) return 'Share';
    const m = policy.data?.mode;
    if (m === 'direct') return 'Share';
    if (m === 'courtesy') return courtesyReview ? 'Send for review' : 'Share';
    return 'Submit for approval';
  })();

  const share = async () => {
    if (!author || !items.length) return;
    setBusy(true);
    try {
      const uploaded: MediaDTO[] = [];
      for (const [i, it] of items.entries()) {
        const blob = it.kind === 'image' ? await renderEdited(it.url, it.area, it.filter) : it.file;
        uploaded.push(
          await uploadFile(
            it.kind === 'image' ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : it.file,
            it.kind,
            { onProgress: (p) => setProgress((i + p) / items.length) },
          ),
        );
      }
      if (mode === 'story') {
        const r = await api.post<{ type: string }>('/v1/stories', {
          authorAccountId: author.id,
          mediaId: uploaded[0].id,
          caption: caption || undefined,
        });
        toast(r.type === 'draft' ? 'Story sent for approval' : 'Added to your story');
        qc.invalidateQueries({ queryKey: qk.storiesRail });
      } else {
        const kind = mode === 'reel' ? 'reel' : uploaded.length > 1 ? 'carousel' : 'photo';
        const r = await api.post<CreatePostResult>('/v1/posts', {
          authorAccountId: author.id,
          kind,
          caption,
          altText: alt || undefined,
          locationLabel: location || undefined,
          taggedHandles: tags
            .split(',')
            .map((handle) => handle.trim().replace(/^@/, ''))
            .filter(Boolean),
          mediaIds: uploaded.map((u) => u.id),
          requestReview: courtesyReview || undefined,
        });
        toast(r.type === 'draft' ? 'Submitted for approval in the group chat' : 'Shared');
        qc.invalidateQueries({ queryKey: qk.feed });
        qc.invalidateQueries({ queryKey: ['account'] });
      }
      maybeAskPush();
      router.replace(author.group ? `/g/${author.handle}` : '/');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const header = (title: string, right?: React.ReactNode, onBack?: () => void) => (
    <header className="chrome flex h-[44px] items-center px-3 pt-safe">
      <button
        type="button"
        aria-label={onBack ? 'Back' : 'Close'}
        className="press"
        onClick={onBack ?? (() => router.back())}
      >
        {onBack ? <ChevronLeft size={28} /> : <X size={26} />}
      </button>
      <h1 className="flex-1 text-center text-[16px] font-semibold">{title}</h1>
      <div className="min-w-10 text-right">{right}</div>
    </header>
  );

  return (
    <ModalScreen className="md:mx-auto md:max-w-[640px] md:border-x md:hairline">
      {step === 'pick' && (
        <>
          {header(
            mode === 'post' ? 'New post' : mode === 'story' ? 'Add to story' : 'New reel',
            items.length ? (
              <button
                type="button"
                className="font-semibold text-action"
                onClick={() => setStep(items[0].kind === 'image' ? 'edit' : 'details')}
              >
                Next
              </button>
            ) : null,
          )}
          <div className="relative aspect-square w-full bg-surface-2">
            {cur ? (
              cur.kind === 'video' ? (
                <video src={cur.url} className="h-full w-full object-contain" controls playsInline />
              ) : (
                <img src={cur.url} alt="" className="h-full w-full object-cover" />
              )
            ) : (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex h-full w-full flex-col items-center justify-center gap-3 text-ink-2"
              >
                <ImagePlus size={56} strokeWidth={1.25} />
                <span className="text-[16px]">
                  {mode === 'reel'
                    ? 'Select a video (60 s max)'
                    : mode === 'story'
                      ? 'Select a photo'
                      : 'Select photos (up to 10)'}
                </span>
              </button>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[16px] font-semibold">Recents</span>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="press flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold"
            >
              <Copy size={14} /> {mode === 'post' ? 'Select multiple' : 'Choose'}
            </button>
          </div>
          <div className="grid flex-1 grid-cols-4 content-start gap-px overflow-y-auto">
            {items.map((it, i) => (
              <button
                key={it.url}
                type="button"
                onClick={() => setActive(i)}
                className={cn('relative aspect-square', i === active && 'opacity-60')}
              >
                {it.kind === 'video' ? (
                  <video src={it.url} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={it.url} alt="" className="h-full w-full object-cover" />
                )}
                {items.length > 1 && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-action text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            ref={input}
            type="file"
            hidden
            multiple={mode === 'post'}
            accept={mode === 'reel' ? 'video/*' : 'image/*'}
            onChange={(e) => {
              pick(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <div className="chrome flex justify-center gap-6 pb-safe pt-2 text-[14px] font-semibold">
            {(['post', 'story', 'reel'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setItems([]);
                }}
                className={cn(
                  'press px-2 py-2 uppercase tracking-wide',
                  mode === m ? 'text-ink' : 'text-ink-2',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'edit' && cur && (
        <>
          {header(
            'Edit',
            <button type="button" className="font-semibold text-action" onClick={() => setStep('details')}>
              Next
            </button>,
            () => setStep('pick'),
          )}
          <div className="relative aspect-square w-full bg-black">
            <Cropper
              image={cur.url}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, px) =>
                setItems((xs) => xs.map((x, i) => (i === active ? { ...x, area: px } : x)))
              }
              style={{ mediaStyle: { filter: cur.filter } }}
            />
          </div>
          <div className="flex justify-center gap-2 py-2">
            {[
              [1, '1:1'],
              [4 / 5, '4:5'],
              [1.91, '1.91:1'],
            ].map(([v, l]) => (
              <button
                key={String(l)}
                type="button"
                onClick={() => setAspect(v as number)}
                className={cn(
                  'rounded-full px-3 py-1 text-[13px] font-semibold',
                  aspect === v ? 'bg-ink text-bg' : 'bg-surface-2',
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 py-3">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() =>
                  setItems((xs) => xs.map((x, i) => (i === active ? { ...x, filter: f.css } : x)))
                }
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    'text-[12px] font-semibold',
                    cur.filter === f.css ? 'text-ink' : 'text-ink-2',
                  )}
                >
                  {f.label}
                </span>
                <img src={cur.url} alt="" className="h-20 w-20 object-cover" style={{ filter: f.css }} />
              </button>
            ))}
          </div>
          {items.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-safe">
              {items.map((it, i) => (
                <button
                  key={it.url}
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    'h-12 w-12 shrink-0 overflow-hidden rounded',
                    i === active && 'ring-2 ring-action',
                  )}
                >
                  <img
                    src={it.url}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ filter: it.filter }}
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === 'details' && (
        <>
          {header(mode === 'story' ? 'Add to story' : mode === 'reel' ? 'New reel' : 'New post', null, () =>
            setStep(items[0]?.kind === 'image' ? 'edit' : 'pick'),
          )}
          <div className="flex-1 overflow-y-auto">
            <div className="flex gap-3 border-b hairline p-4">
              {cur &&
                (cur.kind === 'image' ? (
                  <img
                    src={cur.url}
                    alt=""
                    className="h-20 w-20 object-cover"
                    style={{ filter: cur.filter }}
                  />
                ) : (
                  <video src={cur.url} className="h-20 w-20 object-cover" muted />
                ))}
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={2200}
                placeholder={mode === 'story' ? 'Add a caption…' : 'Write a caption…'}
                className="min-h-20 flex-1 resize-none bg-transparent text-[16px] outline-none placeholder:text-ink-2"
              />
            </div>
            <ListRow
              title="Post as"
              right={
                <span className="flex items-center gap-2 text-ink-2">
                  <Avatar src={author?.avatarUrl} name={author?.displayName} size={24} />
                  {author?.handle}
                </span>
              }
              onClick={() => setPickAuthor(true)}
            />
            {mode !== 'story' && (
              <>
                <div className="border-t hairline px-4 py-2">
                  <Field
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Add location"
                    maxLength={80}
                    className="border-0 bg-transparent px-0"
                  />
                </div>
                <div className="border-t hairline px-4 py-2">
                  <Field
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                    placeholder="Alt text (describe the photo)"
                    maxLength={500}
                    className="border-0 bg-transparent px-0"
                  />
                  <button
                    type="button"
                    className="mt-1 text-[13px] font-semibold text-action"
                    onClick={async () => {
                      if (alt.trim()) return;
                      try {
                        const suggestion = await api.post<{ alt: string }>('/v1/media/alt-text', { caption });
                        if (suggestion.alt) setAlt(suggestion.alt);
                      } catch {
                        /* a missing suggestion still lets the post go out */
                      }
                    }}
                  >
                    Suggest alt text
                  </button>
                </div>
                <div className="border-t hairline px-4 py-2">
                  <Field
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Tag people by handle, separated by commas"
                    className="border-0 bg-transparent px-0"
                  />
                </div>
              </>
            )}
            {author?.group && (
              <div className="border-t hairline px-4 py-3 text-[13px] text-ink-2">
                {policy.data?.mode === 'direct' && 'Members can publish directly to this group account.'}
                {policy.data?.mode === 'threshold' &&
                  `Needs ${policy.data.threshold ?? 1} approvals from the group before it's published.`}
                {policy.data?.mode === 'unanimous' &&
                  'Every eligible member must approve before it is published.'}
                {policy.data?.mode === 'courtesy' && (
                  <span className="flex items-center justify-between gap-3 text-ink">
                    Send for courtesy review
                    <Toggle
                      checked={courtesyReview}
                      onChange={setCourtesyReview}
                      label="Send for courtesy review"
                    />
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="border-t hairline p-4 pb-safe">
            {busy && progress > 0 && (
              <div className="mb-2 h-1 overflow-hidden rounded bg-surface-2">
                <div
                  className="h-full bg-action transition-[width]"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}
            <Button block size="lg" loading={busy} onClick={share}>
              {buttonLabel}
            </Button>
          </div>
          <Sheet open={pickAuthor} onOpenChange={setPickAuthor} title="Post as">
            <div className="pb-6">
              {accounts.map((a) => (
                <ListRow
                  key={a.id}
                  chevron={false}
                  icon={<Avatar src={a.avatarUrl} name={a.displayName} size={40} />}
                  title={a.handle}
                  subtitle={a.group ? 'Group account' : 'You'}
                  right={
                    a.id === author?.id ? (
                      <span className="h-5 w-5 rounded-full border-[6px] border-ink" />
                    ) : (
                      <span className="h-5 w-5 rounded-full border-2 border-line" />
                    )
                  }
                  onClick={() => {
                    setAuthorId(a.id);
                    setPickAuthor(false);
                  }}
                />
              ))}
            </div>
          </Sheet>
        </>
      )}
    </ModalScreen>
  );
}
