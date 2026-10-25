'use client';
import { getStroke } from 'perfect-freehand';
import { useEffect, useRef } from 'react';
import { getSocket, onEvent } from '@/lib/socket';

type Pt = [number, number, number];

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

/** Pictionary canvas: perfect-freehand strokes; points stream over `game.stroke` (throttled to 30 Hz), never persisted. */
export function PictionaryCanvas({
  gameId,
  canDraw,
  round,
}: { gameId: string; canDraw: boolean; round: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cur = useRef<Pt[]>([]);
  const sent = useRef(0);
  const last = useRef(0);

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
    getSocket().emit('game.stroke', { gameId, points: pts, color: '#1E2A44', size: 8 });
    sent.current = cur.current.length;
  };
  const redrawLocal = () => {
    const c = ref.current!;
    draw(c.getContext('2d')!, cur.current, '#1E2A44', 8, c.width);
  };
  return (
    <canvas
      ref={ref}
      className="aspect-square w-full touch-none rounded-2xl border hairline bg-white"
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
  );
}
