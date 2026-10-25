'use client';
import type { ConversationDTO } from '@lore/shared/dto/chat';
import type { PostDTO } from '@lore/shared/dto/social';
import type { ProfileDTO } from '@lore/shared/dto/users';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  Clapperboard,
  Grid3x3,
  Lock,
  Menu,
  MoreHorizontal,
  PlusSquare,
  SquareUser,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Grid3 } from '@/components/ui/Grid3';
import { HighlightsRow } from '@/components/ui/HighlightsRow';
import { ListRow } from '@/components/ui/ListRow';
import { ProfileHeader } from '@/components/ui/ProfileHeader';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import { EditProfileSheet } from './EditProfileSheet';

type Tab = 'posts' | 'reels' | 'tagged';

/** Profile (personal or group) mirroring Instagram's layout (section 9.2). `root` = own profile tab. */
export function ProfileView({ handle, root }: { handle: string; root?: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const [tab, setTab] = useState<Tab>('posts');
  const [switcher, setSwitcher] = useState(false);
  const [editing, setEditing] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const profile = useQuery({
    queryKey: qk.account(handle),
    queryFn: () => api.get<ProfileDTO>(`/v1/accounts/${handle}`),
    retry: false,
  });
  const p = profile.data;
  const postsQ = useInfiniteQuery({
    queryKey: qk.accountPosts(p?.id ?? '', tab),
    enabled: Boolean(p?.id) && tab !== 'tagged',
    queryFn: ({ pageParam }) =>
      api.get<{ items: PostDTO[]; nextCursor: string | null }>(
        `/v1/accounts/${p!.id}/posts?tab=${tab}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });

  const follow = async () => {
    if (!p) return;
    const was = p;
    const next = p.viewer.following || p.viewer.pending ? 'none' : 'follow';
    qc.setQueryData<ProfileDTO>(qk.account(handle), {
      ...p,
      viewer: {
        ...p.viewer,
        following: next === 'follow' && p.visibility === 'public',
        pending: next === 'follow' && p.visibility === 'private',
      },
      counts: { ...p.counts, followers: p.counts.followers + (next === 'follow' ? 1 : -1) },
    });
    try {
      if (next === 'follow') await api.post(`/v1/accounts/${p.id}/follow`);
      else await api.del(`/v1/accounts/${p.id}/follow`);
      qc.invalidateQueries({ queryKey: qk.feed });
    } catch (e) {
      qc.setQueryData(qk.account(handle), was);
      toast((e as Error).message, 'error');
    }
  };

  const message = async () => {
    if (!p) return;
    if (p.type === 'group' && p.conversationId && p.viewer.isMember)
      return router.push(`/c/${p.conversationId}`);
    try {
      const otherUser = await api.get<{ userId: string }>(`/v1/accounts/${p.id}/owner`);
      const c = await api.post<ConversationDTO>('/v1/conversations', {
        kind: 'dm',
        memberUserIds: [otherUser.userId],
      });
      router.push(`/c/${c.id}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const posts = postsQ.data?.pages.flatMap((x) => x.items) ?? [];
  const isGroup = p?.type === 'group';
  const groups = me.data?.groupAccounts ?? [];

  const title = (
    <button
      type="button"
      className="press flex items-center gap-1 text-[20px] font-bold"
      onClick={() => root && setSwitcher(true)}
    >
      {p?.visibility === 'private' && <Lock size={14} />}
      {handle}
      {root && <ChevronDown size={18} />}
    </button>
  );

  return (
    <div className="mx-auto max-w-[935px]">
      <TopBar
        back={!root}
        title={root ? undefined : handle}
        left={root ? title : undefined}
        right={
          root ? (
            <>
              <Link href="/create" aria-label="Create" className="press">
                <PlusSquare size={26} strokeWidth={1.75} />
              </Link>
              <Link href="/settings" aria-label="Settings" className="press">
                <Menu size={26} strokeWidth={1.75} />
              </Link>
            </>
          ) : (
            <MoreHorizontal size={24} />
          )
        }
      />
      <PullToRefresh onRefresh={() => Promise.all([profile.refetch(), postsQ.refetch()])}>
        {profile.isLoading && (
          <div className="flex items-center gap-6 p-4">
            <Skeleton round className="h-[86px] w-[86px]" />
            <Skeleton className="h-10 flex-1" />
          </div>
        )}
        {profile.error && (
          <EmptyState
            title="Sorry, this page isn't available."
            body="The link may be broken, or the profile may have been removed."
          />
        )}
        {p && (
          <>
            <ProfileHeader
              profile={p}
              actions={
                p.viewer.isSelf ? (
                  <>
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditing(true)}>
                      Edit profile
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        navigator.clipboard?.writeText(`${location.origin}/u/${p.handle}`);
                        toast('Link copied');
                      }}
                    >
                      Share profile
                    </Button>
                  </>
                ) : (
                  <>
                    {!(isGroup && p.viewer.isMember) && (
                      <Button
                        variant={p.viewer.following || p.viewer.pending ? 'secondary' : 'primary'}
                        size="sm"
                        className="flex-1"
                        onClick={follow}
                      >
                        {p.viewer.following ? 'Following' : p.viewer.pending ? 'Requested' : 'Follow'}
                      </Button>
                    )}
                    {(!isGroup || p.viewer.isMember) && (
                      <Button variant="secondary" size="sm" className="flex-1" onClick={message}>
                        Message
                      </Button>
                    )}
                    {isGroup && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => setMembersOpen(true)}
                      >
                        <Users size={16} /> Members
                      </Button>
                    )}
                  </>
                )
              }
            />
            {!isGroup && (
              <HighlightsRow
                title={p.viewer.isSelf ? 'Your groups' : undefined}
                items={(p.publicGroups ?? []).map((g) => ({
                  id: g.id,
                  href: `/g/${g.handle}`,
                  label: g.handle,
                  avatars: g.memberAvatars ?? [g.avatarUrl],
                }))}
              />
            )}
            <div className="mt-4">
              <SegmentedTabs<Tab>
                value={tab}
                onChange={setTab}
                tabs={[
                  { key: 'posts', icon: Grid3x3, label: 'Posts' },
                  { key: 'reels', icon: Clapperboard, label: 'Reels' },
                  { key: 'tagged', icon: SquareUser, label: 'Tagged' },
                ]}
              />
            </div>
            {!p.viewer.canSeePosts ? (
              <EmptyState
                icon={Lock}
                title="This account is private"
                body="Follow this account to see their photos and videos."
              />
            ) : tab === 'tagged' ? (
              <EmptyState
                icon={SquareUser}
                title="Photos of you"
                body="When people tag you in photos, they'll appear here."
              />
            ) : postsQ.isLoading ? (
              <div className="grid grid-cols-3 gap-px">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-none" />
                ))}
              </div>
            ) : posts.length ? (
              <Grid3 posts={posts} />
            ) : (
              <EmptyState
                icon={tab === 'reels' ? Clapperboard : Grid3x3}
                title={p.viewer.isSelf ? 'Share photos' : 'No posts yet'}
                body={
                  p.viewer.isSelf ? 'When you share photos, they will appear on your profile.' : undefined
                }
                action={
                  p.viewer.isSelf ? (
                    <Link href="/create" className="font-semibold text-action">
                      Share your first photo
                    </Link>
                  ) : undefined
                }
              />
            )}
          </>
        )}
      </PullToRefresh>

      <Sheet open={switcher} onOpenChange={setSwitcher} title="Switch accounts">
        <div className="pb-6">
          {me.data?.personalAccount && (
            <ListRow
              icon={
                <Avatar
                  src={me.data.personalAccount.avatarUrl}
                  name={me.data.personalAccount.displayName}
                  size={40}
                />
              }
              title={me.data.personalAccount.handle}
              subtitle="Personal account"
              chevron={false}
              onClick={() => setSwitcher(false)}
            />
          )}
          {groups.map((g) => (
            <ListRow
              key={g.id}
              icon={<Avatar src={g.avatarUrl} name={g.displayName} size={40} />}
              title={g.handle}
              subtitle="Group account"
              onClick={() => {
                setSwitcher(false);
                router.push(`/g/${g.handle}`);
              }}
            />
          ))}
          {!groups.length && (
            <p className="px-5 py-3 text-[13px] text-ink-2">
              Create a group account from a group chat's Details screen.
            </p>
          )}
        </div>
      </Sheet>
      {p?.viewer.isSelf && <EditProfileSheet open={editing} onOpenChange={setEditing} profile={p} />}
      <Sheet open={membersOpen} onOpenChange={setMembersOpen} title="Members">
        <div className="pb-6">
          {(p?.members ?? []).map((m) => (
            <ListRow
              key={m.id}
              href={`/u/${m.handle}`}
              icon={<Avatar src={m.avatarUrl} name={m.displayName} size={40} />}
              title={m.handle}
              subtitle={m.displayName}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
