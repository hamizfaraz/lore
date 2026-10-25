'use client';
import { Eraser, RotateCcw } from 'lucide-react';
import { getStroke } from 'perfect-freehand';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { tap } from '@/lib/haptics';
import { getSocket, onEvent } from '@/lib/socket';

type Pt = [number, number, number];

const PALETTE = [
  { color: '#1E293B', label: 'Ink' },
  { color: '#EF4444', label: 'Ruby' },
  { color: '#3B82F6', label: 'Sky' },
  { color: '#10B981', label: 'Emerald' },
  { color: '#F59E0B', label: 'Amber' },
  { color: '#8B5CF6', label: 'Violet' },
  { color: '#FFFFFF', label: 'Eraser', icon: Eraser },
];

const STROKE_SIZES = [
  { size: 5, label: 'Fine' },
  { size: 9, label: 'Medium' },
  { size: 16, label: 'Thick' },
];

function draw(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, size: number, w: number) {
  const outline = getStroke(
    pts.map(([x, y, p]) => [x * w, y * w, p]),
    { size: size * (w / 400), thinning: 0.5, smoothing: 0.5, streamline: 0.5 },
  );
  if (!outline.length) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  for (const [x, y] of outline) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Pictionary studio tablet canvas [C1 / Playmode]:
 * Multi-color palette, stroke width control, perfect-freehand smoothing, and 30Hz streaming.
 */
export function PictionaryCanvas({
  gameId,
  canDraw,
  round,
}: { gameId: string; canDraw: boolean; round: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cur = useRef<Pt[]>([]);
  const sent = useRef(0);
  const last = useRef(0);

  const [activeColor, setActiveColor] = useState('#1E293B');
  const [activeSize, setActiveSize] = useState(9);

  // Keep ref up to date for event handlers
  const colorRef = useRef(activeColor);
  colorRef.current = activeColor;
  const sizeRef = useRef(activeSize);
  sizeRef.current = activeSize;

  const clearBoard = () => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
  };

  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientWidth * dpr;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);

    return onEvent('game.stroke', (e) => {
      if (e.data.gameId !== gameId) return;
      draw(ctx, e.data.points as Pt[], e.data.color, e.data.size, c.width);
    });
  }, [gameId, round]);

  const pos = (e: React.PointerEvent): Pt => {
    const r = ref.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width, e.pressure || 0.5];
  };

  const flush = (force = false) => {
    const now = performance.now();
    if (!force && now - last.current < 33) return;
    last.current = now;
    const pts = cur.current.slice(Math.max(0, sent.current - 1));
    if (pts.length < 2) return;
    getSocket().emit('game.stroke', {
      gameId,
      points: pts,
      color: colorRef.current,
      size: sizeRef.current,
    });
    sent.current = cur.current.length;
  };

  const redrawLocal = () => {
    const c = ref.current!;
    draw(c.getContext('2d')!, cur.current, colorRef.current, sizeRef.current, c.width);
  };

  return (
    <div className="relative space-y-2">
      {/* Tablet Canvas Surface */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-slate-700/30 bg-white shadow-2xl">
        <canvas
          ref={ref}
          className="aspect-square w-full touch-none bg-white"
          onPointerDown={(e) => {
            if (!canDraw) return;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            cur.current = [pos(e)];
            sent.current = 0;
          }}
          onPointerMove={(e) => {
            if (!canDraw || !cur.current.length || e.buttons === 0) return;
            cur.current.push(pos(e));
            redrawLocal();
            flush();
          }}
          onPointerUp={() => {
            if (!canDraw) return;
            flush(true);
            cur.current = [];
          }}
        />

        {/* Spectator Watermark */}
        {!canDraw && (
          <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
            Live Stream
          </div>
        )}
      </div>

      {/* Drawer Studio Dock (Only shown to active drawer) */}
      {canDraw && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/80 p-2.5 backdrop-blur-md">
          {/* Colors */}
          <div className="flex items-center gap-1.5">
            {PALETTE.map((p) => {
              const selected = activeColor === p.color;
              const Icon = p.icon;
              return (
                <button
                  key={p.color}
                  type="button"
                  title={p.label}
                  onClick={() => {
                    tap();
                    setActiveColor(p.color);
                  }}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full transition-transform active:scale-90',
                    selected
                      ? 'scale-110 ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900'
                      : 'opacity-85',
                    p.color === '#FFFFFF' ? 'border border-slate-400 bg-white text-slate-800' : '',
                  )}
                  style={{ backgroundColor: p.color }}
                >
                  {Icon && <Icon size={12} />}
                </button>
              );
            })}
          </div>

          {/* Stroke Sizes & Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-0.5">
              {STROKE_SIZES.map((s) => (
                <button
                  key={s.size}
                  type="button"
                  onClick={() => {
                    tap();
                    setActiveSize(s.size);
                  }}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white transition-colors',
                    activeSize === s.size ? 'bg-cyan-500 text-slate-950' : 'hover:bg-slate-700',
                  )}
                >
                  <span
                    className="rounded-full bg-current"
                    style={{ width: `${Math.max(3, s.size / 2)}px`, height: `${Math.max(3, s.size / 2)}px` }}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              title="Clear Canvas"
              onClick={() => {
                tap();
                clearBoard();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white active:scale-95"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
