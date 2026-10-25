'use client';
import type { ConversationDTO, MemberDTO } from '@lore/shared/dto/chat';
import type { MemberRole, MuteScope } from '@lore/shared/enums';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ListRow, SectionHeader } from '@/components/ui/ListRow';
import { Sheet, SheetAction } from '@/components/ui/Sheet';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import { GroupAccountSection } from './GroupAccountSection';

/** Chat settings [C1] (pushed from Details): name, members, roles, temporary mutes, group account + policy. */
export function ChatSettingsPage({ id }: { id: string }) {
  const qc = useQueryClient();
  const me = useMe();
  const conv = useQuery({
    queryKey: qk.conversation(id),
    queryFn: () => api.get<ConversationDTO>(`/v1/conversations/${id}`),
  });
  const [target, setTarget] = useState<MemberDTO | null>(null);
  const [muteFor, setMuteFor] = useState<MemberDTO | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const c = conv.data;
  const refresh = () => qc.invalidateQueries({ queryKey: qk.conversation(id) });
  if (!c)
    return (
      <StackScreen>
        <TopBar back title="Settings" />
      </StackScreen>
    );
  const isPrimary = c.myRole === 'primary_admin';
  const isAdmin = isPrimary || c.myRole === 'admin';

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      refresh();
      if (ok) toast(ok);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
    setTarget(null);
    setMuteFor(null);
  };
  const setRole = (u: MemberDTO, role: MemberRole) =>
    act(() => api.patch(`/v1/conversations/${id}/members/${u.userId}/role`, { role }), 'Role updated');
  const mute = (u: MemberDTO, scope: MuteScope, minutes: number) =>
    act(
      () => api.patch(`/v1/conversations/${id}/mute`, { userId: u.userId, scope, minutes }),
      `Muted ${scope}`,
    );

  return (
    <StackScreen>
      <TopBar back title="Settings" />
      <div className="mx-auto w-full max-w-[600px] pb-16">
        {c.kind === 'group' && (
          <>
            <SectionHeader>Group name</SectionHeader>
            <div className="flex gap-2 px-4">
              <input
                value={title ?? c.title}
                disabled={!isAdmin}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 flex-1 rounded-lg bg-surface-2 px-3 text-[16px] outline-none"
              />
              {title !== null && title !== c.title && (
                <Button
                  onClick={() =>
                    act(() => api.patch(`/v1/conversations/${id}`, { title }), 'Renamed').then(() =>
                      setTitle(null),
                    )
                  }
                >
                  Save
                </Button>
              )}
            </div>
          </>
        )}
        <SectionHeader>Members</SectionHeader>
        {c.members.map((m) => (
          <ListRow
            key={m.userId}
            icon={<Avatar src={m.avatarUrl} name={m.displayName} size={40} />}
            title={m.displayName}
            subtitle={[
              m.role.replace('_', ' '),
              m.muteScope
                ? `muted ${m.muteScope} until ${new Date(m.muteUntil!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
            onClick={
              isAdmin && m.userId !== me.data?.user.id && m.role !== 'primary_admin'
                ? () => setTarget(m)
                : undefined
            }
          />
        ))}
        <div id="group-account">{c.kind === 'group' && <GroupAccountSection conv={c} />}</div>
      </div>
      <Sheet open={Boolean(target)} onOpenChange={(v) => !v && setTarget(null)} title={target?.displayName}>
        {target && (
          <div className="pb-6">
            {isPrimary && target.role !== 'admin' && (
              <SheetAction onClick={() => setRole(target, 'admin')}>Make admin</SheetAction>
            )}
            {isPrimary && target.role === 'admin' && (
              <SheetAction onClick={() => setRole(target, 'member')}>Remove as admin</SheetAction>
            )}
            {target.role !== 'publisher' && target.role !== 'admin' && (
              <SheetAction onClick={() => setRole(target, 'publisher')}>Make publisher</SheetAction>
            )}
            {target.role === 'publisher' && (
              <SheetAction onClick={() => setRole(target, 'member')}>Remove as publisher</SheetAction>
            )}
            <SheetAction
              onClick={() => {
                setMuteFor(target);
                setTarget(null);
              }}
            >
              Temporarily mute…
            </SheetAction>
            {target.muteScope && (
              <SheetAction
                onClick={() =>
                  act(
                    () =>
                      api.patch(`/v1/conversations/${id}/mute`, {
                        userId: target.userId,
                        scope: target.muteScope,
                        minutes: 0,
                      }),
                    'Unmuted',
                  )
                }
              >
                Unmute
              </SheetAction>
            )}
            <SheetAction
              danger
              onClick={() =>
                confirm(`Remove ${target.displayName}?`) &&
                act(() => api.del(`/v1/conversations/${id}/members/${target.userId}`), 'Removed')
              }
            >
              Remove from group
            </SheetAction>
          </div>
        )}
      </Sheet>
      <Sheet
        open={Boolean(muteFor)}
        onOpenChange={(v) => !v && setMuteFor(null)}
        title={`Mute ${muteFor?.displayName ?? ''}`}
      >
        {muteFor && (
          <div className="pb-6">
            {(['chat', 'games', 'publishing'] as MuteScope[]).flatMap((scope) =>
              [30, 120].map((min) => (
                <SheetAction key={`${scope}-${min}`} onClick={() => mute(muteFor, scope, min)}>
                  Mute {scope} for {min < 60 ? `${min} min` : `${min / 60} h`}
                </SheetAction>
              )),
            )}
          </div>
        )}
      </Sheet>
    </StackScreen>
  );
}
