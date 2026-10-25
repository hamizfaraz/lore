'use client';
import type { MediaDTO } from '@lore/shared/dto/media';
import { ChevronDown, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/** Voice note bubble: play/pause, waveform, duration, "Transcribing…" then a collapsible transcript. */
export function VoicePlayer({
  media,
  waveform,
  own,
  degraded = false,
}: { media: MediaDTO; waveform?: number[]; own: boolean; degraded?: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [p, setP] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const a = new Audio(media.url);
    audio.current = a;
    a.ontimeupdate = () => setP(a.duration ? a.currentTime / a.duration : 0);
    a.onended = () => {
      setPlaying(false);
      setP(0);
    };
    return () => a.pause();
  }, [media.url]);
  const bars = waveform?.length
    ? waveform
    : Array.from({ length: 32 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 1.7)));
  const dur = Math.round((media.durationMs ?? 0) / 1000);
  return (
    <div
      className={cn(
        'w-[240px] rounded-[22px] px-3 py-2',
        own ? 'bg-action text-white' : 'bg-surface-2 text-ink',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play voice message'}
          onClick={() => {
            const a = audio.current;
            if (!a) return;
            if (playing) a.pause();
            else void a.play();
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <div className="flex h-7 flex-1 items-center gap-[2px]">
          {bars.map((b, i) => (
            <span
              key={i}
              className={cn(
                'w-[3px] rounded-full',
                i / bars.length <= p ? 'opacity-100' : 'opacity-45',
                own ? 'bg-white' : 'bg-ink',
              )}
              style={{ height: `${Math.max(15, b * 100)}%` }}
            />
          ))}
        </div>
        <span className="text-[12px] tabular-nums opacity-80">
          {dur ? `0:${String(dur).padStart(2, '0')}` : ''}
        </span>
      </div>
      {media.transcriptStatus === 'pending' && <p className="mt-1 text-[12px] opacity-75">Transcribing…</p>}
      {media.transcriptStatus === 'failed' && (
        <p className="mt-1 text-[12px] opacity-75">Transcript unavailable</p>
      )}
      {degraded && media.transcript && <p className="mt-1 text-[12px] opacity-75">Approximate transcript</p>}
      {media.transcript && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 flex w-full items-start gap-1 text-left text-[13px] opacity-90"
        >
          <span className={cn(!open && 'line-clamp-1')}>{media.transcript}</span>
          <ChevronDown
            size={14}
            className={cn('mt-0.5 shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>
      )}
    </div>
  );
}
