import type { NotificationDTO } from '@lore/shared/dto/notifications';
import Link from 'next/link';
import { ago } from '@/lib/time';
import { cn } from '@/lib/cn';
import { Avatar } from './Avatar';

/** avatar, text with bold handle, time, thumbnail or action button (section 9.2). */
export function NotificationRow({ n, action }: { n: NotificationDTO; action?: React.ReactNode }) {
  const p = n.payload;
  return (
    <Link
      href={p.href}
      className={cn(
        'press flex items-center gap-3.5 mx-2 my-0.5 px-3 py-2.5 rounded-2xl transition-colors hover:bg-surface-2/80',
        !n.readAt && 'bg-indigo-50/50 dark:bg-indigo-950/30',
      )}
    >
      <Avatar src={p.actorAvatarUrl ?? null} name={p.actorName} size={44} />
      <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
        {p.actorHandle && <b className="font-bold text-ink">{p.actorHandle} </b>}
        <span className="text-ink">{p.text}</span>{' '}
        <span className="text-ink-2 text-[12px]">{ago(n.createdAt)}</span>
      </p>
      {action ??
        (p.thumbUrl ? (
          <img
            src={p.thumbUrl}
            alt=""
            className="h-11 w-11 rounded-xl border border-line/60 object-cover shadow-xs"
          />
        ) : null)}
    </Link>
  );
}
