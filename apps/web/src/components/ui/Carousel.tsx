'use client';
import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/** Full-bleed media carousel with dots below (post anatomy, section 9.2). */
export function Carousel({
  slides,
  aspect = 1,
  className,
}: { slides: React.ReactNode[]; aspect?: number; className?: string }) {
  const [ref, embla] = useEmblaCarousel({ loop: false, align: 'start' });
  const [i, setI] = useState(0);
  const onSelect = useCallback(() => embla && setI(embla.selectedScrollSnap()), [embla]);
  useEffect(() => {
    embla?.on('select', onSelect);
    return () => {
      embla?.off('select', onSelect);
    };
  }, [embla, onSelect]);
  return (
    <div className={className} data-carousel>
      <div className="relative overflow-hidden" ref={ref}>
        <div className="flex">
          {slides.map((s, k) => (
            <div
              key={k}
              className="relative min-w-0 shrink-0 grow-0 basis-full"
              style={{ aspectRatio: String(aspect) }}
            >
              {s}
            </div>
          ))}
        </div>
        {slides.length > 1 && (
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-medium text-white">
            {i + 1}/{slides.length}
          </span>
        )}
      </div>
      {slides.length > 1 && <CarouselDots count={slides.length} index={i} />}
    </div>
  );
}

export function CarouselDots({ count, index }: { count: number; index: number }) {
  return (
    <div className="flex justify-center gap-1 pt-2.5">
      {Array.from({ length: count }).map((_, k) => (
        <span
          key={k}
          className={cn('h-1.5 w-1.5 rounded-full transition-colors', k === index ? 'bg-action' : 'bg-line')}
        />
      ))}
    </div>
  );
}
