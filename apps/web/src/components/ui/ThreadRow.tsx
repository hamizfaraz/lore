import type { ConversationRowDTO } from '@lore/shared/dto/chat';
import { Camera } from 'lucide-react';
import Link from 'next/link';
import { ago } from '@/lib/time';
import { cn } from '@/lib/cn';
import { AvatarStack } from './Avatar';
import { AiPill } from './Labels';

/** DM inbox row: avatar (56), name, last message + time, unread blue dot, camera icon (section 9.2). */
export function ThreadRow({ row }: { row: ConversationRowDTO }) {
  const unread = row.unreadCount > 0;
  const lm = row.lastMessage;
  return (
    <Link href={`/c/${row.id}`} className="press flex items-center gap-3 px-4 py-2">
      <AvatarStack srcs={row.avatars} size={56} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className={cn('truncate text-[14px]', unread ? 'font-semibold' : '')}>{row.title}</p>
        <p
          className={cn(
            'mt-0.5 flex items-center gap-1 truncate text-[13px]',
            unread ? 'font-semibold text-ink' : 'text-ink-2',
          )}
        >
          {lm?.isAi && <AiPill className="shrink-0" />}
          <span className="truncate">
            {lm ? `${lm.senderName ? `${lm.senderName}: ` : ''}${lm.preview}` : 'Say hi'}
          </span>
          {lm && <span className="shrink-0 text-ink-2"> · {ago(lm.at)}</span>}
        </p>
      </div>
      {unread ? (
        <span className="h-2 w-2 shrink-0 rounded-full bg-action" aria-label={`${row.unreadCount} unread`} />
      ) : (
        <Camera size={24} strokeWidth={1.5} className="shrink-0 text-ink-2" />
      )}
    </Link>
  );
}
