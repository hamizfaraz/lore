'use client';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveCaption } from '@/features/voice/LiveCaption';
import { tap } from '@/lib/haptics';

const MAX_MS = 60_000;

/**
 * Hold-to-record voice notes (section 8.2 step 5): MediaRecorder Opus, slide left to cancel, max 60 s,
 * live waveform; C2's LiveCaption shows live captions above while recording.
 */
export function useVoiceRecorder(onDone: (blob: Blob, durationMs: number, waveform: number[]) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const start = useRef(0);
  const startX = useRef(0);
  const cancelled = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wave = useRef<number[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);

  const stop = useCallback((cancel: boolean) => {
    cancelled.current = cancel;
    if (timer.current) clearInterval(timer.current);
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
    setRecording(false);
    setCancelArmed(false);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }, []);

  const onMove = useCallback((e: PointerEvent) => setCancelArmed(startX.current - e.clientX > 90), []);
  const onUp = useCallback((e: PointerEvent) => stop(startX.current - e.clientX > 90), [stop]);

  const begin = useCallback(
    async (e: React.PointerEvent) => {
      e.preventDefault();
      startX.current = e.clientX;
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        setStream(s);
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
        const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
        chunks.current = [];
        wave.current = [];
        r.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
        r.onstop = () => {
          s.getTracks().forEach((t) => t.stop());
          setStream(null);
          void audioCtx.current?.close();
          const dur = Date.now() - start.current;
          if (!cancelled.current && dur > 600)
            onDone(
              new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }),
              dur,
              downsample(wave.current, 40),
            );
        };
        const ctx = new AudioContext();
        audioCtx.current = ctx;
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        rec.current = r;
        r.start(250);
        start.current = Date.now();
        cancelled.current = false;
        setRecording(true);
        tap();
        timer.current = setInterval(() => {
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          wave.current.push(peak / 128);
          setLevels((l) => [...l.slice(-39), peak / 128]);
          const el = Date.now() - start.current;
          setElapsed(el);
          if (el >= MAX_MS) stop(false);
        }, 100);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      } catch {
        alert('Microphone access is needed to record voice notes.');
      }
    },
    [onDone, onMove, onUp, stop],
  );

  useEffect(() => () => stop(true), [stop]);
  return { recording, elapsed, cancelArmed, levels, stream, begin, stop };
}

function downsample(xs: number[], n: number) {
  if (xs.length <= n) return xs.map((x) => Math.round(x * 100) / 100);
  const out: number[] = [];
  const step = xs.length / n;
  for (let i = 0; i < n; i++)
    out.push(Math.round(Math.max(...xs.slice(Math.floor(i * step), Math.floor((i + 1) * step))) * 100) / 100);
  return out;
}

export function RecordingBar({
  elapsed,
  levels,
  cancelArmed,
  onCancel,
}: { elapsed: number; levels: number[]; cancelArmed: boolean; onCancel: () => void }) {
  const s = Math.floor(elapsed / 1000);
  return (
    <div className="flex h-9 flex-1 items-center gap-3 pl-3">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-heart" />
      <span className="w-10 text-[14px] tabular-nums">{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}</span>
      <div className="flex h-6 flex-1 items-center gap-[2px] overflow-hidden">
        {levels.map((l, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-ai"
            style={{ height: `${Math.max(12, l * 100)}%` }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className={cancelArmed ? 'text-heart' : 'text-ink-2'}
        aria-label="Cancel recording"
      >
        {cancelArmed ? (
          <Trash2 size={20} />
        ) : (
          <span className="flex items-center text-[13px]">
            <ChevronLeft size={16} />
            Slide to cancel
          </span>
        )}
      </button>
    </div>
  );
}

export { LiveCaption };
