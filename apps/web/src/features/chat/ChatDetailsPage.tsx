'use client';
import type { ConversationDTO } from '@lore/shared/dto/chat';
import type { MediaDTO } from '@lore/shared/dto/media';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, Link2, LogOut, Mic, Settings, ShieldCheck, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Toggle } from '@/components/ui/Field';
import { ListRow, SectionHeader } from '@/components/ui/ListRow';
import { Sheet, SheetAction } from '@/components/ui/Sheet';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { spaceTabs } from '@/features/groups/space/tabs';
import { AiMemberPanel } from '@/features/persona/AiMemberPanel';
import { api } from '@/lib/api';
import { clientFlags } from '@/lib/flags';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import { NewMessageSheet } from './NewMessageSheet';

const ROLE_LABEL = { primary_admin: 'Creator', admin: 'Admin', publisher: 'Publisher', member: '' } as const;

/** Chat Details [C1]: Instagram's Details screen with LORE round buttons and sections (section 9.2). */
export function ChatDetailsPage({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const meId = me.data?.user.id;
  const conv = useQuery({
    queryKey: qk.conversation(id),
    queryFn: () => api.get<ConversationDTO>(`/v1/conversations/${id}`),
  });
  const media = useQuery({
    queryKey: ['conversation', id, 'media'],
    queryFn: () => api.get<{ items: MediaDTO[] }>(`/v1/conversations/${id}/media`),
  });
  const [muteOpen, setMuteOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const c = conv.data;
  if (!c)
    return (
      <StackScreen>
        <TopBar back title="Details" />
      </StackScreen>
    );
  const mine = c.members.find((m) => m.userId === meId);
  const isAdmin = c.myRole === 'primary_admin' || c.myRole === 'admin';
  const others = c.members.filter((m) => m.userId !== meId);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.conversation(id) });

  const muteSelf = async (minutes: number | null) => {
    await api.patch(`/v1/conversations/${id}/mute`, { scope: null, minutes });
    setMuteOpen(false);
    refresh();
    toast(minutes === 0 ? 'Unmuted' : 'Notifications muted');
  };

  return (
    <StackScreen>
      <TopBar back title="Details" />
      <div className="mx-auto w-full max-w-[600px] pb-12">
        <div className="flex flex-col items-center gap-2 pb-4 pt-6">
          {c.kind === 'group' ? (
            <AvatarStack srcs={others.map((o) => o.avatarUrl)} size={88} />
          ) : (
            <Avatar src={c.avatarUrl} name={c.title} size={88} />
          )}
          <p className="text-[20px] font-bold">{c.title}</p>
          {c.groupAccount && (
            <Link href={`/g/${c.groupAccount.handle}`} className="text-[14px] text-action">
              @{c.groupAccount.handle}
            </Link>
          )}
        </div>
        <div className="flex justify-center gap-4 px-4 pb-4">
          {(c.kind === 'group'
            ? spaceTabs.filter((t) => t.id !== 'chat')
            : spaceTabs.filter((t) => t.id === 'plans' || t.id === 'games')
          ).map((t) => {
            const href = t.href({ conversationId: id, groupHandle: c.groupAccount?.handle ?? null });
            return (
              <Link
                key={t.id}
                href={href ?? '#'}
                className="press flex w-16 flex-col items-center gap-1.5 text-[12px]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
                  <t.icon size={22} />
                </span>
                {t.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMuteOpen(true)}
            className="press flex w-16 flex-col items-center gap-1.5 text-[12px]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
              <BellOff size={22} />
            </span>
            {mine?.muteUntil ? 'Muted' : 'Mute'}
          </button>
        </div>

        {c.kind === 'group' && (
          <>
            <SectionHeader
              action={
                isAdmin ? (
                  <button
                    type="button"
                    className="text-[14px] font-semibold text-action"
                    onClick={() => setAdding(true)}
                  >
                    Add
                  </button>
                ) : undefined
              }
            >
              Members
            </SectionHeader>
            {c.members.map((m) => (
              <ListRow
                key={m.userId}
                href={m.handle ? `/u/${m.handle}` : undefined}
                icon={<Avatar src={m.avatarUrl} name={m.displayName} size={44} />}
                title={m.userId === meId ? `${m.displayName} (you)` : m.displayName}
                subtitle={[m.handle, ROLE_LABEL[m.role], m.muteScope ? `muted: ${m.muteScope}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
            {isAdmin && (
              <ListRow icon={<UserPlus size={22} />} title="Add people" onClick={() => setAdding(true)} />
            )}
            <SectionHeader>AI member</SectionHeader>
            <AiMemberPanel conversationId={id} persona={c.persona} />
            <SectionHeader>Group account</SectionHeader>
            {c.groupAccount ? (
              <ListRow
                icon={<Avatar src={c.groupAccount.avatarUrl} name={c.groupAccount.displayName} size={32} />}
                title={`@${c.groupAccount.handle}`}
                subtitle="Publishing policy, drafts and approvals"
                href={`/c/${id}/settings#group-account`}
              />
            ) : (
              <ListRow
                icon={<ShieldCheck size={22} />}
                title="Create group account"
                subtitle="A shared profile the group posts to together"
                href={`/c/${id}/settings#group-account`}
              />
            )}
            {clientFlags.podcast && (
              <>
                <SectionHeader>Podcast</SectionHeader>
                <ListRow
                  icon={<Mic size={22} />}
                  title="We should start a podcast"
                  href={`/c/${id}/memories#podcast`}
                />
              </>
            )}
            {isAdmin && (
              <ListRow
                icon={<Settings size={22} />}
                title="Settings"
                subtitle="Roles, mutes, name"
                href={`/c/${id}/settings`}
              />
            )}
            {isAdmin && (
              <ListRow
                icon={<Link2 size={22} />}
                title="Invite link"
                subtitle="Guests can join for 2 hours"
                onClick={async () => {
                  const r = await api.post<{ path: string }>(`/v1/conversations/${id}/join-link`);
                  const url = `${location.origin}${r.path}`;
                  await navigator.clipboard?.writeText(url).catch(() => {});
                  toast('Invite link copied');
                }}
              />
            )}
          </>
        )}

        <SectionHeader>Privacy</SectionHeader>
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="flex-1">
            <span className="block text-[15px]">Let the AI member read my messages</span>
            <span className="block text-[13px] text-ink-2">When off, your messages are hidden from AI</span>
          </span>
          <Toggle
            checked={mine?.aiHistoryConsent ?? true}
            onChange={async (v) => {
              await api.patch(`/v1/conversations/${id}/me`, { aiHistoryConsent: v });
              refresh();
            }}
            label="AI history consent"
          />
        </div>

        {!!media.data?.items.length && (
          <>
            <SectionHeader>Photos and videos</SectionHeader>
            <div id="media" className="grid grid-cols-4 gap-px px-0">
              {media.data.items.slice(0, 16).map((m) => (
                <img
                  key={m.id}
                  src={m.thumbUrl ?? m.url}
                  alt={m.altText ?? ''}
                  className="aspect-square w-full object-cover"
                />
              ))}
            </div>
          </>
        )}

        {c.kind === 'group' && (
          <div className="pt-6">
            <ListRow
              danger
              icon={<LogOut size={22} className="text-heart" />}
              title="Leave chat"
              chevron={false}
              onClick={async () => {
                if (!confirm('Leave this chat?')) return;
                await api.del(`/v1/conversations/${id}/members/${meId}`);
                qc.invalidateQueries({ queryKey: qk.inbox });
                router.replace('/inbox');
              }}
            />
          </div>
        )}
      </div>
      <Sheet open={muteOpen} onOpenChange={setMuteOpen} title="Mute notifications">
        <div className="pb-6">
          <SheetAction onClick={() => muteSelf(60)}>For 1 hour</SheetAction>
          <SheetAction onClick={() => muteSelf(8 * 60)}>For 8 hours</SheetAction>
          <SheetAction onClick={() => muteSelf(null)}>Until I change it</SheetAction>
          {mine?.muteUntil && <SheetAction onClick={() => muteSelf(0)}>Unmute</SheetAction>}
        </div>
      </Sheet>
      <NewMessageSheet
        open={adding}
        onOpenChange={(v) => {
          setAdding(v);
          if (!v) refresh();
        }}
        mode="add"
        conversationId={id}
      />
    </StackScreen>
  );
}
