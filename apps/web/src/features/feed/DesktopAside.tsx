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
      {acct && (
        <Link href={`/u/${acct.handle}`} className="press flex min-h-[44px] items-center gap-3 py-2">
          <Avatar src={acct.avatarUrl} name={acct.displayName} size={56} />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold">{acct.handle}</span>
            <span className="block truncate text-[14px] text-ink-2">{acct.displayName}</span>
          </span>
        </Link>
      )}
      <div className="mb-1 mt-6 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-ink-2">Suggestions for you</h2>
        <Link href="/explore" className="press text-[12px] font-semibold">
          See all
        </Link>
      </div>
      {list.length > 0 ? (
        <FriendsOnLore friends={list} compact />
      ) : (
        <p className="py-3 text-[14px] text-ink-2">
          People you follow and Facebook friends who join LORE show up here.{' '}
          <Link href="/explore" className="font-semibold text-action">
            Search
          </Link>
        </p>
      )}
    </aside>
  );
}
