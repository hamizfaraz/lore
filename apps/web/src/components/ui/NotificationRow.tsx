import type { NotificationDTO } from '@lore/shared/dto/notifications';
import Link from 'next/link';
import { ago } from '@/lib/time';
import { cn } from '@/lib/cn';
import { Avatar } from './Avatar';

/** avatar, text with bold handle, time, thumbnail or action button (section 9.2). */
export function NotificationRow({ n, action }: { n: NotificationDTO; action?: React.ReactNode }) {
  const p = n.payload;
  return (
    <Link href={p.href} className={cn('press flex items-center gap-3 px-4 py-2', !n.readAt && 'bg-action/5')}>
      <Avatar src={p.actorAvatarUrl ?? null} name={p.actorName} size={44} />
      <p className="min-w-0 flex-1 text-[14px] leading-snug">
        {p.actorHandle && <b className="font-semibold">{p.actorHandle} </b>}
        {p.text} <span className="text-ink-2">{ago(n.createdAt)}</span>
      </p>
      {action ??
        (p.thumbUrl ? <img src={p.thumbUrl} alt="" className="h-11 w-11 rounded object-cover" /> : null)}
    </Link>
  );
}
