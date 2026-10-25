import type { ProfileDTO } from '@lore/shared/dto/users';
import { Users } from 'lucide-react';
import { compact } from '@/lib/time';
import { Avatar, AvatarStack } from './Avatar';

/** Refreshed profile header with clean stats capsules and group member chips. */
export function ProfileHeader({
  profile,
  actions,
  groupExtras,
}: { profile: ProfileDTO; actions: React.ReactNode; groupExtras?: React.ReactNode }) {
  const isGroup = profile.type === 'group';
  return (
    <section className="px-4 pt-3 pb-2">
      <div className="flex items-center gap-5">
        <div className="shrink-0">
          {isGroup ? (
            <AvatarStack
              srcs={profile.members?.map((m) => m.avatarUrl) ?? [profile.avatarUrl]}
              size={84}
              max={2}
            />
          ) : (
            <Avatar src={profile.avatarUrl} name={profile.displayName} size={84} />
          )}
        </div>
        <div className="flex flex-1 justify-between gap-2 text-center">
          <Stat n={profile.counts.posts} label="posts" />
          <Stat n={profile.counts.followers} label="followers" />
          <Stat n={profile.counts.following} label="following" />
        </div>
      </div>
      <div className="mt-3.5 space-y-1 text-[14px]">
        <div className="flex items-center gap-2">
          <p className="font-bold text-[16px] text-ink">{profile.displayName}</p>
          {isGroup && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50">
              Group Circle
            </span>
          )}
        </div>
        {isGroup && (
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
            <Users size={13} /> Managed democratically by {profile.members?.length ?? 0} members
          </p>
        )}
        {profile.bio && (
          <p className="whitespace-pre-line text-[13px] text-ink-2 leading-relaxed">{profile.bio}</p>
        )}
      </div>
      {groupExtras}
      <div className="mt-3.5 flex gap-2">{actions}</div>
    </section>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl bg-surface-2/60 border border-line/40 py-2 px-1 text-center">
      <div className="text-[15px] font-bold text-ink">{compact(n)}</div>
      <div className="text-[11px] font-medium text-ink-2 capitalize">{label}</div>
    </div>
  );
}
