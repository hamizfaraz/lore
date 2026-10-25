'use client';
import type { ConnectionsDTO } from '@lore/shared/dto/graph';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { FriendsOnLore } from '@/features/profile/FriendsOnLore';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';

/** Instagram desktop right column: your account and suggestions (section 9.3). Shown from xl up. */
export function DesktopAside() {
  const me = useMe();
  const acct = me.data?.personalAccount;
  const friends = useQuery({
    queryKey: qk.connections,
    queryFn: () => api.get<ConnectionsDTO>('/v1/graph/connections'),
    staleTime: 60_000,
  });
  const list = friends.data?.friendsOnLore ?? [];
  return (
    <aside className="sticky top-8 hidden w-[319px] shrink-0 self-start xl:block" aria-label="Suggestions">
      <div className="p-4 rounded-2xl bg-elevated border border-line/60 shadow-sm">
        {acct && (
          <Link
            href={`/u/${acct.handle}`}
            className="press flex min-h-[44px] items-center gap-3 pb-3 border-b border-line/50"
          >
            <Avatar src={acct.avatarUrl} name={acct.displayName} size={50} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold text-ink">{acct.handle}</span>
              <span className="block truncate text-[12px] text-ink-2">{acct.displayName}</span>
            </span>
          </Link>
        )}
        <div className="mb-2 mt-4 flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-ink">Suggested Circles & Friends</h2>
          <Link href="/explore" className="press text-[12px] font-semibold text-action hover:underline">
            See all
          </Link>
        </div>
        {list.length > 0 ? (
          <FriendsOnLore friends={list} compact />
        ) : (
          <p className="py-2 text-[13px] text-ink-2 leading-relaxed">
            People you connect with and circles that join LORE show up here.{' '}
            <Link href="/explore" className="font-semibold text-action hover:underline">
              Find circles
            </Link>
          </p>
        )}
      </div>
    </aside>
  );
}
