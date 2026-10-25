'use client';
import type { DiscoveryOverviewDTO } from '@lore/shared/dto/discovery';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Compass, LockKeyhole, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';

export function FindFriendsPage() {
  const client = useQueryClient();
  const me = useMe();
  const params = useSearchParams();
  const tab = params.get('tab') === 'together' ? 'together' : 'friends';
  const key = ['discovery'] as const;
  const discovery = useQuery({
    queryKey: key,
    queryFn: () => api.get<DiscoveryOverviewDTO>('/v1/discovery'),
  });
  const [tags, setTags] = useState('');
  const [bio, setBio] = useState('');
  useEffect(() => {
    if (!discovery.data) return;
    setTags(discovery.data.profile.explicitTags.join(', '));
    setBio(discovery.data.profile.bioSnippet ?? '');
  }, [discovery.data]);
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const parsedTags = tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const profile = useMutation({
    mutationFn: (
      patch: {
        discoverable?: boolean;
        explicitTags?: string[];
        removedTags?: string[];
        frozen?: boolean;
      } = {},
    ) =>
      api.put('/v1/discovery/profile', {
        explicitTags: patch.explicitTags ?? parsedTags,
        bioSnippet: bio || null,
        discoverable: patch.discoverable ?? data?.profile.discoverable ?? false,
        removedTags: patch.removedTags,
        frozen: patch.frozen,
      }),
    onSuccess: refresh,
  });
  const intro = useMutation({
    mutationFn: ({ userId, firstMessage }: { userId: string; firstMessage: string }) =>
      api.post('/v1/discovery/introductions', { toUserId: userId, firstMessage }),
    onSuccess: refresh,
  });
  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' }) =>
      api.patch(`/v1/discovery/introductions/${id}`, { action }),
    onSuccess: refresh,
  });
  const data = discovery.data;
  const showFriends = tab === 'friends';

  return (
    <StackScreen>
      <TopBar title={showFriends ? 'Find Friends' : 'Discover Together'} back />
      <main className="mx-auto w-full max-w-[640px] flex-1 space-y-5 px-4 pb-24 pt-4">
        <div className="flex gap-2">
          <Link
            href="/find-friends"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${showFriends ? 'bg-action text-white' : 'bg-surface-2'}`}
          >
            Find Friends
          </Link>
          <Link
            href="/find-friends?tab=together"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${showFriends ? 'bg-surface-2' : 'bg-action text-white'}`}
          >
            Discover Together
          </Link>
        </div>
        {showFriends && (
          <section className="rounded-2xl bg-surface-2 p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-ai" />
              <h1 className="font-display text-[21px] font-semibold">Common Ground</h1>
            </div>
            <p className="mt-1 text-[12px] text-ink-2">
              Only interests you choose and signals from public activity are used. Private chats are never
              read.
            </p>
            <label htmlFor="discovery-tags" className="mt-4 block text-[13px] font-semibold">
              Your interests
            </label>
            <input
              id="discovery-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="climbing, live music, coffee"
              className="mt-1 w-full rounded-xl border bg-bg px-3 py-2 hairline"
            />
            <label htmlFor="discovery-bio" className="mt-3 block text-[13px] font-semibold">
              Short public intro
            </label>
            <textarea
              id="discovery-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={180}
              placeholder="What are you hoping to find?"
              className="mt-1 min-h-16 w-full rounded-xl border bg-bg p-3 hairline"
            />
            <div className="mt-3 flex gap-2">
              <Button
                loading={profile.isPending}
                onClick={() => profile.mutate({ discoverable: data?.profile.discoverable ?? false })}
              >
                Save
              </Button>
              <Button
                variant={data?.profile.discoverable ? 'outline' : 'primary'}
                loading={profile.isPending}
                onClick={() => profile.mutate({ discoverable: !data?.profile.discoverable })}
              >
                {data?.profile.discoverable ? 'Pause discovery' : 'Opt in to discovery'}
              </Button>
            </div>
            {!!data?.profile.inferredTags.length && (
              <div className="mt-4">
                <p className="text-[13px] font-semibold">Learned from public activity</p>
                <ul className="mt-2 space-y-2">
                  {data.profile.inferredTags.map((item) => (
                    <li key={item.tag} className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        {item.tag} <span className="text-ink-2">{Math.round(item.score * 100)}%</span>
                      </span>
                      <span className="flex gap-2">
                        <Button
                          size="sm"
                          variant="text"
                          onClick={() =>
                            profile.mutate({ explicitTags: [...new Set([...parsedTags, item.tag])] })
                          }
                        >
                          Keep
                        </Button>
                        <Button
                          size="sm"
                          variant="text"
                          onClick={() => profile.mutate({ removedTags: [item.tag] })}
                        >
                          Remove
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              variant="text"
              className="mt-3"
              onClick={() => profile.mutate({ frozen: !data?.profile.frozen })}
            >
              {data?.profile.frozen ? 'Unfreeze inferred interests' : 'Freeze inferred interests'}
            </Button>
            {data?.profile.frozen && (
              <p className="mt-2 flex items-center gap-1 text-[12px] text-ink-2">
                <LockKeyhole size={13} /> Inferred interests are frozen.
              </p>
            )}
          </section>
        )}

        {!showFriends && discovery.isLoading && (
          <p className="py-10 text-center text-ink-2">Finding common ground…</p>
        )}
        {!showFriends && data && !data.profile.discoverable && (
          <EmptyState
            icon={LockKeyhole}
            title="Discovery is off"
            body="Opt in when you want to be shown to people with shared interests."
          />
        )}
        {!showFriends && data?.profile.discoverable && !data.matches.length && (
          <EmptyState
            icon={Compass}
            title="No matches yet"
            body="Add a few interests and check back as the community grows."
          />
        )}
        {!showFriends &&
          data?.matches.map((card) => (
            <MatchCard
              key={card.userId}
              card={card}
              busy={intro.isPending}
              onIntro={(firstMessage) => intro.mutate({ userId: card.userId, firstMessage })}
            />
          ))}

        {!showFriends && !!data?.introductions.length && (
          <section className="space-y-3">
            <h2 className="font-display text-[19px] font-semibold">Introductions</h2>
            {data.introductions.map((item) => {
              const incoming = item.to.id === me.data?.personalAccount?.id;
              const person = incoming ? item.from : item.to;
              return (
                <article key={item.id} className="rounded-2xl border bg-bg p-4 hairline">
                  <div className="flex items-center gap-3">
                    <Avatar src={person.avatarUrl} name={person.displayName} size={42} />
                    <div>
                      <p className="font-semibold">{person.displayName}</p>
                      <p className="text-[12px] capitalize text-ink-2">{item.state}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[14px]">“{item.firstMessage}”</p>
                  {incoming && item.state === 'requested' && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => decide.mutate({ id: item.id, action: 'accept' })}>
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="text"
                        onClick={() => decide.mutate({ id: item.id, action: 'decline' })}
                      >
                        Not now
                      </Button>
                    </div>
                  )}
                  {item.state === 'accepted' && item.conversationId && (
                    <Link
                      href={`/c/${item.conversationId}`}
                      className="mt-3 block text-[13px] font-semibold text-action"
                    >
                      Open chat
                    </Link>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </main>
    </StackScreen>
  );
}

function MatchCard({
  card,
  busy,
  onIntro,
}: { card: DiscoveryOverviewDTO['matches'][number]; busy: boolean; onIntro: (message: string) => void }) {
  const [starter, setStarter] = useState(card.starter);
  return (
    <article className="rounded-2xl border bg-bg p-4 hairline">
      <div className="flex items-center gap-3">
        <Avatar src={card.account.avatarUrl} name={card.account.displayName} size={52} />
        <div>
          <h2 className="font-semibold">{card.account.displayName}</h2>
          <p className="text-[12px] text-ink-2">@{card.account.handle}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {card.sharedTags.map((tag) => (
          <span key={tag} className="rounded-full bg-ai-tint px-2.5 py-1 text-[12px] text-ai">
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[14px]">{card.reason}</p>
      {card.bioSnippet && <p className="mt-1 text-[12px] text-ink-2">{card.bioSnippet}</p>}
      <textarea
        aria-label={`Message to ${card.account.displayName}`}
        value={starter}
        onChange={(event) => setStarter(event.target.value)}
        maxLength={280}
        className="mt-3 min-h-16 w-full rounded-xl border bg-surface-2 p-3 text-[13px] hairline"
      />
      <Button size="sm" loading={busy} onClick={() => onIntro(starter)}>
        Ask to connect
      </Button>
    </article>
  );
}
