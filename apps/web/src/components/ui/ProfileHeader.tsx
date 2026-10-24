import type { ProfileDTO } from '@lore/shared/dto/users';
import { Users } from 'lucide-react';
import { compact } from '@/lib/time';
import { Avatar, AvatarStack } from './Avatar';

/** Avatar left, stats Posts / Followers / Following right; name, bio, buttons (section 9.2). */
export function ProfileHeader({
  profile,
  actions,
  groupExtras,
}: { profile: ProfileDTO; actions: React.ReactNode; groupExtras?: React.ReactNode }) {
  const isGroup = profile.type === 'group';
  return (
    <section className="px-4 pt-3">
      <div className="flex items-center gap-6">
        {isGroup ? (
          <AvatarStack
            srcs={profile.members?.map((m) => m.avatarUrl) ?? [profile.avatarUrl]}
            size={86}
            max={2}
          />
        ) : (
          <Avatar src={profile.avatarUrl} name={profile.displayName} size={86} />
        )}
        <div className="flex flex-1 justify-around text-center">
          <Stat n={profile.counts.posts} label="posts" />
          <Stat n={profile.counts.followers} label="followers" />
          <Stat n={profile.counts.following} label="following" />
        </div>
      </div>
      <div className="mt-3 space-y-0.5 text-[14px]">
        <p className="font-semibold">{profile.displayName}</p>
        {isGroup && (
          <p className="flex items-center gap-1 text-[13px] text-ink-2">
            <Users size={14} /> Managed by {profile.members?.length ?? 0} members
          </p>
        )}
        {profile.bio && <p className="whitespace-pre-line">{profile.bio}</p>}
      </div>
      {groupExtras}
      <div className="mt-3 flex gap-1.5">{actions}</div>
    </section>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="leading-tight">
      <div className="text-[16px] font-semibold">{compact(n)}</div>
      <div className="text-[13px]">{label}</div>
    </div>
  );
}
