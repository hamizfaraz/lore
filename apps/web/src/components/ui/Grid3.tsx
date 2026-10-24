import type { PostDTO } from '@lore/shared/dto/social';
import { Clapperboard, Copy } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { BlurImage } from './BlurImage';

/** 3-column square grid with 1 px gaps (profile, explore). `tall` makes reels tall tiles in Explore masonry. */
export function Grid3({
  posts,
  tallReels,
  hrefFor,
}: { posts: PostDTO[]; tallReels?: boolean; hrefFor?: (p: PostDTO) => string }) {
  return (
    <div className={cn('grid grid-cols-3 gap-px', tallReels && 'grid-flow-dense')}>
      {posts.map((p, i) => {
        const m = p.media[0];
        const tall = tallReels && p.kind === 'reel' && i % 5 === 2;
        return (
          <Link
            key={p.id}
            href={hrefFor ? hrefFor(p) : `/p/${p.id}`}
            className={cn('press relative block bg-surface-2', tall ? 'row-span-2' : 'aspect-square')}
          >
            {m && <BlurImage src={m.thumbUrl ?? m.url} blurhash={m.blurhash} alt={p.altText ?? ''} />}
            {p.kind === 'carousel' && (
              <Copy size={18} className="absolute right-2 top-2 text-white drop-shadow" />
            )}
            {p.kind === 'reel' && (
              <Clapperboard size={18} className="absolute right-2 top-2 text-white drop-shadow" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
