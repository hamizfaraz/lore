import { cn } from '@/lib/cn';

const initials = (name?: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Round avatar with an initials fallback. Sizes per section 9.1 (32 feed, 56 DM row, 86 profile). */
export function Avatar({
  src,
  name,
  size = 32,
  className,
  ai,
}: { src?: string | null; name?: string | null; size?: number; className?: string; ai?: boolean }) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-ink-2',
        ai && 'bg-ai-tint text-ai',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="font-semibold">{initials(name)}</span>
      )}
    </span>
  );
}

/** Stacked avatars for groups (inbox rows, group badges, voters). */
export function AvatarStack({
  srcs,
  size = 32,
  max = 2,
  className,
}: { srcs: (string | null | undefined)[]; size?: number; max?: number; className?: string }) {
  const list = srcs.slice(0, max);
  if (list.length <= 1) return <Avatar src={list[0]} size={size} className={className} />;
  const inner = Math.round(size * 0.72);
  return (
    <span className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size }}>
      {list.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full ring-2 ring-bg"
          style={{
            width: inner,
            height: inner,
            left: i === 0 ? 0 : size - inner,
            top: i === 0 ? 0 : size - inner,
            zIndex: i,
          }}
        >
          <Avatar src={s} size={inner} />
        </span>
      ))}
    </span>
  );
}

/** Small row of voter/participant avatars with overlap. */
export function AvatarRow({
  items,
  size = 22,
}: { items: { src?: string | null; name?: string; dim?: boolean }[]; size?: number }) {
  return (
    <span className="inline-flex -space-x-1.5">
      {items.map((it, i) => (
        <span key={i} className={cn('rounded-full ring-2 ring-bg', it.dim && 'opacity-35')}>
          <Avatar src={it.src} name={it.name} size={size} />
        </span>
      ))}
    </span>
  );
}
