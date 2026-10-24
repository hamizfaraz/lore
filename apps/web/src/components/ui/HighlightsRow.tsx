import Link from 'next/link';
import { AvatarStack } from './Avatar';

/** Highlights-style row; LORE uses it for "Your groups" on the profile (section 9.2). */
export function HighlightsRow({
  items,
  title,
}: { items: { id: string; href: string; label: string; avatars: (string | null)[] }[]; title?: string }) {
  if (!items.length) return null;
  return (
    <div className="pt-4">
      {title && <p className="px-4 pb-2 text-[13px] font-semibold">{title}</p>}
      <div className="flex gap-4 overflow-x-auto px-4 pb-1">
        {items.map((it) => (
          <Link
            key={it.id}
            href={it.href}
            className="press flex w-[66px] shrink-0 flex-col items-center gap-1"
          >
            <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full border hairline p-1">
              <AvatarStack srcs={it.avatars} size={54} />
            </span>
            <span className="w-full truncate text-center text-[12px]">{it.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
