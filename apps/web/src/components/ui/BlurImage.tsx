'use client';
import { decode } from 'blurhash';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/** Image with a blurhash placeholder (zero layout shift: parent sets the aspect ratio). */
export function BlurImage({
  src,
  blurhash,
  alt = '',
  className,
  onLoad,
}: { src: string; blurhash?: string | null; alt?: string; className?: string; onLoad?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!blurhash || !canvas.current) return;
    try {
      const px = decode(blurhash, 32, 32);
      const ctx = canvas.current.getContext('2d')!;
      const img = ctx.createImageData(32, 32);
      img.data.set(px);
      ctx.putImageData(img, 0, 0);
    } catch {}
  }, [blurhash]);
  return (
    <span className={cn('relative block h-full w-full overflow-hidden bg-surface-2', className)}>
      {blurhash && (
        <canvas
          ref={canvas}
          width={32}
          height={32}
          className={cn('absolute inset-0 h-full w-full transition-opacity', loaded && 'opacity-0')}
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </span>
  );
}
