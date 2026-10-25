import type { ConversationRowDTO } from '@lore/shared/dto/chat';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ago } from '@/lib/time';
import { cn } from '@/lib/cn';
import { AvatarStack } from './Avatar';
import { AiPill } from './Labels';

/** Refreshed thread row with tactile rounded hover card and distinct unread badge. */
export function ThreadRow({ row }: { row: ConversationRowDTO }) {
  const unread = row.unreadCount > 0;
  const lm = row.lastMessage;
  return (
    <Link
      href={`/c/${row.id}`}
      className="press flex items-center gap-3.5 mx-2 px-3 py-2.5 rounded-2xl hover:bg-surface-2/80 transition-colors"
    >
      <div className="shrink-0">
        <AvatarStack srcs={row.avatars} size={52} />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className={cn('truncate text-[14px]', unread ? 'font-bold text-ink' : 'font-semibold text-ink')}>
            {row.title}
          </p>
          {lm && <span className="shrink-0 text-[11px] font-medium text-ink-2">{ago(lm.at)}</span>}
        </div>
        <p
          className={cn(
            'flex items-center gap-1.5 truncate text-[12.5px]',
            unread ? 'font-semibold text-ink' : 'text-ink-2',
          )}
        >
          {lm?.isAi && <AiPill className="shrink-0" />}
          <span className="truncate">
            {lm ? `${lm.senderName ? `${lm.senderName}: ` : ''}${lm.preview}` : 'Start the conversation'}
          </span>
        </p>
      </div>
      {unread ? (
        <span
          className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-action px-1.5 text-[11px] font-bold text-white shadow-sm shrink-0"
          aria-label={`${row.unreadCount} unread`}
        >
          {row.unreadCount}
        </span>
      ) : (
        <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-ink-2/60" />
      )}
    </Link>
  );
}
