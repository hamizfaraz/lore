'use client';
import type { LoreFriendDTO } from '@lore/shared/dto/graph';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';

/** Facebook friends who already have a LORE account, with a follow action (section 8.6). */
export function FriendsOnLore({
  friends,
  compact = false,
}: {
  friends: LoreFriendDTO[];
  /** Explore preview: shorter list, the full list lives under Settings → Facebook. */
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [local, setLocal] = useState<Record<string, { following: boolean; pending: boolean }>>({});
  const rows = compact ? friends.slice(0, 5) : friends;

  const follow = async (f: LoreFriendDTO) => {
    const cur = local[f.id] ?? { following: f.following, pending: Boolean(f.pending) };
    const off = cur.following || cur.pending;
    setLocal((s) => ({
      ...s,
      [f.id]: off
        ? { following: false, pending: false }
        : { following: f.visibility === 'public', pending: f.visibility === 'private' },
    }));
    try {
      if (off) await api.del(`/v1/accounts/${f.id}/follow`);
      else await api.post(`/v1/accounts/${f.id}/follow`);
      qc.invalidateQueries({ queryKey: qk.connections });
      qc.invalidateQueries({ queryKey: qk.feed });
    } catch (e) {
      setLocal((s) => ({ ...s, [f.id]: cur }));
      toast((e as Error).message, 'error');
    }
  };

  if (!friends.length) {
    return (
      <p className="px-4 py-3 text-[14px] text-ink-2">
        When a friend joins LORE with Facebook, they'll show up here.
      </p>
    );
  }

  return (
    <ul>
      {rows.map((f) => {
        const st = local[f.id] ?? { following: f.following, pending: Boolean(f.pending) };
        const label = st.following ? 'Following' : st.pending ? 'Requested' : 'Follow';
        return (
          <li key={f.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2">
            <Link href={`/u/${f.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar src={f.avatarUrl} name={f.displayName} size={44} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold">{f.displayName}</span>
                <span className="block truncate text-[13px] text-ink-2">@{f.handle}</span>
              </span>
            </Link>
            <Button
              size="sm"
              variant={st.following || st.pending ? 'secondary' : 'primary'}
              className="min-h-[44px] min-w-[96px]"
              onClick={() => follow(f)}
            >
              {label}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
