'use client';
import { useRef, useState } from 'react';
import { tap } from '@/lib/haptics';
import { cn } from '@/lib/cn';

/** Press-and-hold for consequential actions (confirm plan, publish). 800 ms fill. */
export function ConfirmHold({
  children,
  onConfirm,
  ms = 800,
  className,
  disabled,
}: {
  children: React.ReactNode;
  onConfirm: () => void;
  ms?: number;
  className?: string;
  disabled?: boolean;
}) {
  const [p, setP] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const begin = () => {
    if (disabled) return;
    start.current = performance.now();
    const step = (t: number) => {
      const v = Math.min(1, (t - start.current) / ms);
      setP(v);
      if (v >= 1) {
        tap(20);
        onConfirm();
        setP(0);
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const end = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    setP(0);
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={end}
      onPointerLeave={end}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'chrome relative h-11 overflow-hidden rounded-lg bg-ink px-5 font-semibold text-bg disabled:opacity-40',
        className,
      )}
    >
      <span className="absolute inset-y-0 left-0 bg-action" style={{ width: `${p * 100}%` }} />
      <span className="relative">{p > 0 ? 'Keep holding…' : children}</span>
    </button>
  );
}
