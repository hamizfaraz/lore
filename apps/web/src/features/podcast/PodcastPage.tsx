'use client';
import type { MediaDTO } from '@lore/shared/dto/media';
import type { PodcastShowDetailDTO } from '@lore/shared/dto/podcast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Circle, GitBranch, Mic2, Radio, Square, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { C2_DEMO_AUDIO, C2_DEMO_USERS, c2DemoHeaders, c2DemoUserId } from '../persona/demo-user';

const options = () => ({ headers: c2DemoHeaders() });

function TwentySecondRecorder({ onReady }: { onReady: (media: MediaDTO) => void }) {
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop();
  const start = async () => {
    setError('');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) return setError('Microphone access is needed to record.');
    chunks.current = [];
    setSeconds(0);
    const next = new MediaRecorder(stream);
    recorder.current = next;
    next.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
    next.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      if (timer.current) clearInterval(timer.current);
      if (elapsed < 19) return setError('Keep recording for the full 20 seconds.');
      setUploading(true);
      try {
        onReady(await uploadFile(new Blob(chunks.current, { type: next.mimeType }), 'audio'));
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    };
    next.start(250);
    let elapsed = 0;
    timer.current = setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed >= 20) stop();
    }, 1000);
  };
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <div className="flex items-center gap-3">
        <Button
          variant={recorder.current?.state === 'recording' ? 'danger' : 'outline'}
          size="icon"
          disabled={uploading}
          onClick={recorder.current?.state === 'recording' ? stop : start}
          aria-label={recorder.current?.state === 'recording' ? 'Stop recording' : 'Start recording'}
        >
          {recorder.current?.state === 'recording' ? <Square size={18} /> : <Mic2 size={18} />}
        </Button>
        <div className="flex-1">
          <p className="font-semibold">Exactly 20 seconds</p>
          <p className="text-xs text-ink-2">
            {uploading ? 'Uploading…' : `${Math.min(seconds, 20)} / 20 seconds`}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-action transition-[width]"
          style={{ width: `${Math.min(100, seconds * 5)}%` }}
        />
      </div>
      {error && <p className="mt-2 text-xs text-heart">{error}</p>}
    </div>
  );
}

export function PodcastPage({ showId }: { showId: string }) {
  const viewer = typeof window === 'undefined' ? '' : c2DemoUserId();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const show = useQuery({
    queryKey: ['podcast', showId, viewer],
    queryFn: () => api.get<PodcastShowDetailDTO>(`/v1/podcasts/${showId}`, options()),
    retry: false,
  });
  const refresh = () => show.refetch();
  const contribute = useMutation({
    mutationFn: (input: { stationId: string; mediaId: string; replyToId?: string }) =>
      api.post<PodcastShowDetailDTO>(
        `/v1/podcasts/${showId}/stations/${input.stationId}/contributions`,
        { mediaId: input.mediaId, replyToId: input.replyToId },
        options(),
      ),
    onSuccess: refresh,
  });
  const branch = useMutation({
    mutationFn: (stationId: string) =>
      api.post<PodcastShowDetailDTO>(
        `/v1/podcasts/${showId}/stations/${stationId}/branches`,
        { topic: window.prompt('What should this station explore?') || 'A side story' },
        options(),
      ),
    onSuccess: refresh,
  });
  const wrap = useMutation({
    mutationFn: () => api.post<PodcastShowDetailDTO>(`/v1/podcasts/${showId}/wrap`, {}, options()),
    onSuccess: refresh,
  });
  const finish = useMutation({
    mutationFn: () => api.post<PodcastShowDetailDTO>(`/v1/podcasts/${showId}/finish`, {}, options()),
    onSuccess: refresh,
  });
  const loadAudio = async () => {
    const response = await fetch(`/v1/podcasts/${showId}/audio`, { headers: c2DemoHeaders() });
    if (!response.ok) throw new Error('Audio preview is not ready');
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(await response.blob()));
  };

  if (show.isLoading)
    return (
      <StackScreen>
        <TopBar title="Podcast" back />
        <p className="p-8 text-center text-ink-2">Tuning the station…</p>
      </StackScreen>
    );
  const data = show.data;
  if (!data)
    return (
      <StackScreen>
        <TopBar title="Podcast" back />
        <p className="p-8 text-center text-heart">{show.error?.message ?? 'Show not found'}</p>
      </StackScreen>
    );
  const demoMedia = C2_DEMO_AUDIO[viewer];
  const host = data.hostUserId === viewer;

  return (
    <StackScreen>
      <TopBar title="Podcast" back />
      <main className="mx-auto w-full max-w-[640px] space-y-5 p-4 pb-16">
        <header className="rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white">
          <Radio size={34} />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
            Voice-only group show
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">{data.title}</h1>
          <p className="mt-3 text-sm opacity-80">
            {data.contributions} clips · {data.stations.length} station{data.stations.length === 1 ? '' : 's'}{' '}
            · {data.state.replaceAll('_', ' ')}
          </p>
        </header>

        <section className="rounded-2xl bg-surface-2 p-4">
          <div className="flex items-center gap-2">
            <Users size={18} />
            <h2 className="font-semibold">The cast</h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {data.requiredParticipants.map((participant) => (
              <div key={participant.userId} className="flex items-center gap-2 rounded-xl bg-bg p-3">
                {participant.contributed ? (
                  <Check className="text-verified" size={17} />
                ) : (
                  <Circle className="text-ink-2" size={17} />
                )}
                <span className="text-sm">{participant.displayName}</span>
              </div>
            ))}
          </div>
          {data.missing.length > 0 && (
            <p className="mt-3 text-xs text-ink-2">
              Finish stays locked until every cast member adds a valid clip.
            </p>
          )}
        </section>

        <nav className="flex gap-2 overflow-x-auto" aria-label="Demo member switcher">
          {[
            ['Ava (host)', C2_DEMO_USERS.ava],
            ['Noor (missing)', C2_DEMO_USERS.noor],
          ].map(([label, id]) => (
            <a
              key={id}
              href={`?demoUser=${id}`}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${viewer === id ? 'bg-action text-white' : 'bg-surface-2'}`}
            >
              {label}
            </a>
          ))}
        </nav>

        {data.stations.map((station) => (
          <section key={station.id} className="overflow-hidden rounded-2xl bg-surface-2">
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ai-tint text-ai">
                <Radio size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{station.topic ?? 'Open station'}</h2>
                <p className="text-xs text-ink-2">
                  {station.state} · {station.contributions.length} clips
                </p>
              </div>
              {station.state === 'open' && (
                <button
                  type="button"
                  className="press text-ai"
                  onClick={() => branch.mutate(station.id)}
                  aria-label="Branch station"
                >
                  <GitBranch size={19} />
                </button>
              )}
            </div>
            {station.contributions.map((clip, index) => (
              <article key={clip.id} className="border-t p-4 hairline">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-action text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{clip.displayName} · 0:20</p>
                    <p className="text-xs text-ink-2">
                      {clip.transcript ?? 'Transcript processing…'} · uploaded by {clip.displayName}
                    </p>
                  </div>
                </div>
              </article>
            ))}
            {!station.contributions.some((clip) => clip.userId === viewer) && station.state === 'open' && (
              <div className="border-t p-4 hairline">
                <TwentySecondRecorder
                  onReady={(media) => contribute.mutate({ stationId: station.id, mediaId: media.id })}
                />
                {demoMedia && (
                  <Button
                    className="mt-3"
                    block
                    variant="outline"
                    onClick={() => contribute.mutate({ stationId: station.id, mediaId: demoMedia })}
                  >
                    Use seeded 20-second clip
                  </Button>
                )}
              </div>
            )}
          </section>
        ))}

        {host && !data.wrapped && (
          <Button
            block
            size="lg"
            variant="outline"
            disabled={data.missing.length > 0}
            loading={wrap.isPending}
            onClick={() => wrap.mutate()}
          >
            {data.missing.length
              ? `Waiting for ${data.missing.length} member${data.missing.length === 1 ? '' : 's'}`
              : 'Wrap recording'}
          </Button>
        )}
        {host && data.wrapped && data.state !== 'finished' && (
          <Button
            block
            size="lg"
            disabled={!data.finishEnabled}
            loading={finish.isPending}
            onClick={() => finish.mutate()}
          >
            {data.finishEnabled
              ? 'Finish and render MP3'
              : `Waiting for ${data.missing.length} member${data.missing.length === 1 ? '' : 's'}`}
          </Button>
        )}
        {data.state === 'finished' && (
          <section className="rounded-2xl bg-ai-tint p-4">
            <h2 className="font-semibold">Your episode is ready</h2>
            {!audioUrl ? (
              <Button className="mt-3" variant="ai" onClick={loadAudio}>
                Load MP3
              </Button>
            ) : (
              <audio className="mt-3 w-full" controls src={audioUrl}>
                <track kind="captions" />
              </audio>
            )}
            <p className="mt-2 text-[11px] text-ink-2">
              Intro/outro tones · 300 ms gaps · ordered speaker labels
            </p>
          </section>
        )}
        {[contribute.error, branch.error, wrap.error, finish.error].find(Boolean) && (
          <p role="alert" className="text-center text-sm text-heart">
            {[contribute.error, branch.error, wrap.error, finish.error].find(Boolean)?.message}
          </p>
        )}
      </main>
    </StackScreen>
  );
}
