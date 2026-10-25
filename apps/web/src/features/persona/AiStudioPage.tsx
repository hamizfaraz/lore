'use client';
import type {
  MemoryDTO,
  PersonaAvatarOptionDTO,
  PersonaAvatarSelectionDTO,
  PersonaDTO,
  PersonaTestResponse,
  PersonaUpdateBody,
} from '@lore/shared/dto/persona';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, Check, ChevronDown, ImageIcon, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ListRow, SectionHeader } from '@/components/ui/ListRow';
import { Sheet } from '@/components/ui/Sheet';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { MuteMiloSheet } from './MuteMiloSheet';

const PRESETS = [
  { id: 'milo', name: 'Milo', note: 'Warm, witty, and brief' },
  { id: 'juniper', name: 'Juniper', note: 'Gentle and curious' },
  { id: 'sol', name: 'Sol', note: 'Upbeat and direct' },
  { id: 'custom', name: 'Custom', note: 'Make it yours' },
] as const;

type Draft = PersonaUpdateBody & { preset: (typeof PRESETS)[number]['id'] };

const DEFAULT_DRAFT: Draft = {
  preset: 'milo',
  name: 'Milo',
  initiative: 'balanced',
  tone: ['warm', 'witty', 'brief'],
  interests: ['group plans', 'shared memories'],
  boundaries: 'Never embarrass a member or reveal private preferences.',
  allowHistory: true,
  allowNews: true,
  allowImages: true,
  allowPlans: true,
  allowLocation: false,
  surpriseImagesPerWeek: 1,
  enabled: true,
};

function fromPersona(persona: PersonaDTO): Draft {
  return {
    preset: 'custom',
    name: persona.name,
    initiative: persona.initiative,
    tone: persona.tone,
    interests: persona.interests,
    boundaries: persona.boundaries,
    quietHours: persona.quietHours,
    allowHistory: persona.allowHistory,
    allowNews: persona.allowNews,
    allowImages: persona.allowImages,
    allowPlans: persona.allowPlans,
    allowLocation: persona.allowLocation,
    surpriseImagesPerWeek: persona.surpriseImagesPerWeek,
    enabled: persona.enabled,
  };
}

function Toggle({
  checked,
  onChange,
  label,
  detail,
}: { checked: boolean; onChange: (checked: boolean) => void; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 border-b hairline px-4 py-3 last:border-0">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        <span className="block text-[12px] text-ink-2">{detail}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-7 w-12 rounded-full transition-colors', checked ? 'bg-action' : 'bg-line')}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function AiStudioPage({ conversationId }: { conversationId: string }) {
  const client = useQueryClient();
  const personaKey = ['persona', conversationId] as const;
  const memoryKey = ['persona', conversationId, 'memories'] as const;
  const personaQuery = useQuery({
    queryKey: personaKey,
    queryFn: () => api.get<PersonaDTO | null>(`/v1/conversations/${conversationId}/persona`),
  });
  const memoryQuery = useQuery({
    queryKey: memoryKey,
    queryFn: () => api.get<MemoryDTO[]>(`/v1/conversations/${conversationId}/persona/memories`),
  });
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [muteOpen, setMuteOpen] = useState(false);
  const [memory, setMemory] = useState<MemoryDTO | null>(null);
  const [memorySummary, setMemorySummary] = useState('');
  const [preview, setPreview] = useState<PersonaTestResponse | null>(null);
  const [avatarOptions, setAvatarOptions] = useState<PersonaAvatarOptionDTO[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<PersonaAvatarSelectionDTO | null>(null);

  useEffect(() => {
    if (personaQuery.data) setDraft(fromPersona(personaQuery.data));
  }, [personaQuery.data]);

  const save = useMutation({
    mutationFn: () => api.put<PersonaDTO>(`/v1/conversations/${conversationId}/persona`, draft),
    onSuccess: (persona) => {
      client.setQueryData(personaKey, persona);
      setDraft(fromPersona(persona));
    },
  });
  const test = useMutation({
    mutationFn: () =>
      api.post<PersonaTestResponse>(`/v1/conversations/${conversationId}/persona/test`, {
        ...draft,
        samplePrompt: 'any ideas for something fun this weekend?',
      }),
    onSuccess: setPreview,
  });
  const remove = useMutation({
    mutationFn: () => api.del<void>(`/v1/conversations/${conversationId}/persona`),
    onSuccess: () => {
      client.setQueryData(personaKey, null);
      client.setQueryData(memoryKey, []);
      setDraft(DEFAULT_DRAFT);
    },
  });
  const patchMemory = useMutation({
    mutationFn: () =>
      api.patch<MemoryDTO>(`/v1/conversations/${conversationId}/persona/memories/${memory?.id}`, {
        summary: memorySummary,
      }),
    onSuccess: async () => {
      setMemory(null);
      await client.invalidateQueries({ queryKey: memoryKey });
    },
  });
  const deleteMemory = useMutation({
    mutationFn: (id: string) => api.del<void>(`/v1/conversations/${conversationId}/persona/memories/${id}`),
    onSuccess: async () => {
      setMemory(null);
      await client.invalidateQueries({ queryKey: memoryKey });
    },
  });
  const generateAvatars = useMutation({
    mutationFn: () =>
      api.post<{ options: PersonaAvatarOptionDTO[] }>(
        `/v1/conversations/${conversationId}/persona/avatars`,
        {},
      ),
    onSuccess: (result) => setAvatarOptions(result.options),
  });
  const chooseAvatar = useMutation({
    mutationFn: (style: PersonaAvatarOptionDTO['style']) =>
      api.post<PersonaAvatarSelectionDTO>(`/v1/conversations/${conversationId}/persona/avatar`, { style }),
    onSuccess: (result) => {
      setSelectedAvatar(result);
      if (result.mediaId) setDraft((current) => ({ ...current, avatarMediaId: result.mediaId }));
    },
  });

  const choosePreset = (preset: Draft['preset']) => {
    const selected = PRESETS.find((item) => item.id === preset)!;
    setDraft((current) => ({
      ...current,
      preset,
      name: selected.name === 'Custom' ? current.name : selected.name,
    }));
  };

  if (personaQuery.isLoading) {
    return (
      <StackScreen>
        <TopBar title="AI member" back />
        <p className="p-8 text-center text-ink-2">Loading AI member…</p>
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      <TopBar title="AI member" back />
      <main className="mx-auto w-full max-w-[640px] flex-1 pb-32">
        <section className="px-4 pb-2 pt-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ai-tint text-ai">
            <Sparkles size={30} />
          </span>
          <h1 className="mt-3 font-display text-[24px] font-semibold">
            {personaQuery.data ? draft.name : 'Add an AI member'}
          </h1>
          <p className="mx-auto mt-1 max-w-[430px] text-[13px] text-ink-2">
            Clearly labeled, controlled by your group, and designed to know when to stay quiet.
          </p>
        </section>

        <SectionHeader
          action={
            <button
              type="button"
              onClick={() => generateAvatars.mutate()}
              className="press text-[13px] font-semibold text-ai"
            >
              {generateAvatars.isPending ? 'Drawing…' : avatarOptions.length ? 'New set' : 'Generate 4'}
            </button>
          }
        >
          Avatar
        </SectionHeader>
        <section className="mx-4 rounded-2xl bg-surface-2 p-3">
          {selectedAvatar && (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-bg p-3">
              <img
                src={selectedAvatar.imageUrl}
                alt="Selected AI-generated avatar"
                className="h-14 w-14 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold">Selected avatar</p>
                <p className="text-[11px] text-ink-2">Generated with AI · {selectedAvatar.generator}</p>
                {!selectedAvatar.mediaId && (
                  <p className="text-[11px] text-ink-2">Preview only until C1 media storage is merged.</p>
                )}
              </div>
            </div>
          )}
          {avatarOptions.length ? (
            <div className="grid grid-cols-2 gap-2">
              {avatarOptions.map((option) => (
                <button
                  type="button"
                  key={option.style}
                  disabled={chooseAvatar.isPending}
                  onClick={() => chooseAvatar.mutate(option.style)}
                  className="press overflow-hidden rounded-xl bg-bg text-left"
                >
                  <img
                    src={option.imageUrl}
                    alt={`${option.label}, AI-generated avatar option`}
                    className="aspect-square w-full object-cover"
                  />
                  <span className="block px-3 pt-2 text-sm font-semibold">{option.label}</span>
                  <span className="block px-3 pb-3 text-[10px] text-ink-2">Generated with AI</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => generateAvatars.mutate()}
              className="press flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm text-ink-2 hairline"
            >
              <ImageIcon size={20} /> Generate four house-style options
            </button>
          )}
          {generateAvatars.error && (
            <p role="alert" className="mt-2 text-xs text-heart">
              {generateAvatars.error.message}
            </p>
          )}
        </section>

        <SectionHeader>Personality</SectionHeader>
        <section className="mx-4 overflow-hidden rounded-2xl bg-surface-2 p-3">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => choosePreset(preset.id)}
                className={cn(
                  'press relative rounded-xl border p-3 text-left hairline',
                  draft.preset === preset.id ? 'border-ai bg-ai-tint' : 'bg-bg',
                )}
              >
                <span className="block font-semibold">{preset.name}</span>
                <span className="text-[12px] text-ink-2">{preset.note}</span>
                {draft.preset === preset.id && <Check size={16} className="absolute right-2 top-2 text-ai" />}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-2">Name</span>
            <input
              value={draft.name ?? ''}
              maxLength={32}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-xl border bg-bg px-3 py-2.5 outline-none hairline focus:border-ai"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-2">Tone · comma separated</span>
            <input
              value={(draft.tone ?? []).join(', ')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  tone: event.target.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                }))
              }
              className="w-full rounded-xl border bg-bg px-3 py-2.5 outline-none hairline focus:border-ai"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-2">
              Interests · comma separated
            </span>
            <input
              value={(draft.interests ?? []).join(', ')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  interests: event.target.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                }))
              }
              className="w-full rounded-xl border bg-bg px-3 py-2.5 outline-none hairline focus:border-ai"
            />
          </label>
        </section>

        <SectionHeader>Initiative</SectionHeader>
        <section className="mx-4 grid grid-cols-3 rounded-xl bg-surface-2 p-1">
          {(['quiet', 'balanced', 'lively'] as const).map((initiative) => (
            <button
              key={initiative}
              type="button"
              onClick={() => setDraft((current) => ({ ...current, initiative }))}
              className={cn(
                'press rounded-lg px-2 py-2 capitalize',
                draft.initiative === initiative && 'bg-bg font-semibold shadow-sm',
              )}
            >
              {initiative}
            </button>
          ))}
        </section>
        <p className="px-5 pt-2 text-[12px] text-ink-2">
          Quiet: up to 3 messages/day · Balanced: 8 · Lively: 15
        </p>

        <SectionHeader>Quiet hours</SectionHeader>
        <section className="mx-4 grid grid-cols-2 gap-3 rounded-2xl bg-surface-2 p-3">
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-ink-2">Start</span>
            <input
              type="time"
              value={draft.quietHours?.start ?? '22:00'}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  quietHours: {
                    start: event.target.value,
                    end: current.quietHours?.end ?? '08:00',
                    tz: current.quietHours?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                  },
                }))
              }
              className="w-full rounded-xl border bg-bg p-2 hairline"
            />
          </label>
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-ink-2">End</span>
            <input
              type="time"
              value={draft.quietHours?.end ?? '08:00'}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  quietHours: {
                    start: current.quietHours?.start ?? '22:00',
                    end: event.target.value,
                    tz: current.quietHours?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                  },
                }))
              }
              className="w-full rounded-xl border bg-bg p-2 hairline"
            />
          </label>
          <p className="col-span-2 text-[11px] text-ink-2">
            Time zone: {draft.quietHours?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </section>

        <SectionHeader>Permissions</SectionHeader>
        <section className="mx-4 overflow-hidden rounded-2xl bg-surface-2">
          <Toggle
            checked={draft.allowHistory ?? true}
            onChange={(allowHistory) => setDraft((current) => ({ ...current, allowHistory }))}
            label="Chat history"
            detail="Use messages only from members who consented"
          />
          <Toggle
            checked={draft.allowPlans ?? true}
            onChange={(allowPlans) => setDraft((current) => ({ ...current, allowPlans }))}
            label="Plans"
            detail="Suggest things your group can do together"
          />
          <Toggle
            checked={draft.allowNews ?? true}
            onChange={(allowNews) => setDraft((current) => ({ ...current, allowNews }))}
            label="Sourced news"
            detail="Only speak from a verified candidate"
          />
          <Toggle
            checked={draft.allowImages ?? true}
            onChange={(allowImages) => setDraft((current) => ({ ...current, allowImages }))}
            label="Occasional illustrations"
            detail="At most one surprise image per week"
          />
          <Toggle
            checked={draft.allowLocation ?? false}
            onChange={(allowLocation) => setDraft((current) => ({ ...current, allowLocation }))}
            label="Location context"
            detail="Off by default"
          />
        </section>

        <SectionHeader>Boundaries</SectionHeader>
        <section className="mx-4 rounded-2xl bg-surface-2 p-3">
          <textarea
            value={draft.boundaries ?? ''}
            maxLength={500}
            rows={4}
            onChange={(event) => setDraft((current) => ({ ...current, boundaries: event.target.value }))}
            placeholder="What should your AI member avoid?"
            className="w-full resize-none rounded-xl border bg-bg px-3 py-2.5 outline-none hairline focus:border-ai"
          />
        </section>

        <SectionHeader
          action={
            <button
              type="button"
              onClick={() => test.mutate()}
              className="press text-[13px] font-semibold text-ai"
            >
              {test.isPending ? 'Trying…' : 'Preview'}
            </button>
          }
        >
          Preview
        </SectionHeader>
        <section className="mx-4 rounded-2xl bg-ai-tint p-4">
          {preview?.previews.length ? (
            <div className="space-y-3">
              {preview.previews.map((item, index) => (
                <article key={`${item.reason}-${index}`} className="rounded-xl bg-bg p-3">
                  <div className="flex flex-wrap gap-1 text-[10px] font-semibold text-ai">
                    <span>AI assistant</span>
                    <span>·</span>
                    <span>Generated with AI</span>
                  </div>
                  <p className="mt-2 text-[15px]">{item.message}</p>
                  <p className="mt-2 text-[11px] text-ink-2">Why? {item.reason}</p>
                </article>
              ))}
              {preview.degraded && <p className="text-[11px] text-ink-2">Preview used a safe fallback.</p>}
            </div>
          ) : (
            <p className="text-[13px] text-ink-2">Try the personality without adding it to the chat.</p>
          )}
          {test.error && (
            <p role="alert" className="mt-2 text-xs text-heart">
              {test.error.message}
            </p>
          )}
        </section>

        {personaQuery.data && (
          <>
            <SectionHeader>Controls</SectionHeader>
            <section className="mx-4 overflow-hidden rounded-2xl bg-surface-2">
              <ListRow
                title="Mute AI member"
                subtitle="1 hour, 8 hours, or until unmuted"
                onClick={() => setMuteOpen(true)}
              />
              <ListRow
                title="Remove AI member"
                danger
                chevron={false}
                onClick={() => {
                  if (window.confirm(`Remove ${draft.name ?? 'this AI member'} and its saved memories?`)) {
                    remove.mutate();
                  }
                }}
              />
            </section>

            <SectionHeader>Memories</SectionHeader>
            <section className="mx-4 overflow-hidden rounded-2xl bg-surface-2">
              {memoryQuery.data?.length ? (
                memoryQuery.data.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMemory(item);
                      setMemorySummary(item.summary);
                    }}
                    className="press flex w-full items-center gap-3 border-b px-4 py-3 text-left hairline last:border-0"
                  >
                    <Brain size={19} className="text-ai" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-[14px]">{item.summary}</span>
                      <span className="text-[11px] capitalize text-ink-2">
                        {item.kind} · {item.sensitivity}
                      </span>
                    </span>
                    <ChevronDown size={17} className="-rotate-90 text-ink-2" />
                  </button>
                ))
              ) : (
                <p className="px-4 py-5 text-center text-[13px] text-ink-2">No saved memories yet.</p>
              )}
            </section>
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[640px] border-t bg-bg px-4 pb-safe pt-3 hairline">
        <button
          type="button"
          disabled={save.isPending || !(draft.name ?? '').trim()}
          onClick={() => save.mutate()}
          className="press-btn mb-3 w-full rounded-xl bg-action px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {save.isPending
            ? 'Saving…'
            : personaQuery.data
              ? 'Save changes'
              : `Add ${draft.name || 'AI member'} to chat`}
        </button>
      </div>

      <MuteMiloSheet
        open={muteOpen}
        onOpenChange={setMuteOpen}
        conversationId={conversationId}
        onMuted={(persona) => client.setQueryData(personaKey, persona)}
      />
      <Sheet open={Boolean(memory)} onOpenChange={(open) => !open && setMemory(null)} title="Correct memory">
        <div className="space-y-4 p-5">
          <textarea
            value={memorySummary}
            onChange={(event) => setMemorySummary(event.target.value)}
            rows={4}
            maxLength={280}
            className="w-full resize-none rounded-xl border bg-bg px-3 py-2.5 outline-none hairline focus:border-ai"
          />
          <button
            type="button"
            disabled={!memorySummary.trim() || patchMemory.isPending}
            onClick={() => patchMemory.mutate()}
            className="press-btn w-full rounded-xl bg-action px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            Save correction
          </button>
          <button
            type="button"
            onClick={() => memory && deleteMemory.mutate(memory.id)}
            className="press flex w-full items-center justify-center gap-2 py-2 font-semibold text-heart"
          >
            <Trash2 size={18} /> Delete memory
          </button>
        </div>
      </Sheet>
    </StackScreen>
  );
}
