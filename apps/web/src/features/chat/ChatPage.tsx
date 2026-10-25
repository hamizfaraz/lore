'use client';
import type { CardKind } from '@lore/shared/cards';
import type { ConversationDTO, MessageDTO } from '@lore/shared/dto/chat';
import type { MediaDTO } from '@lore/shared/dto/media';
import { uuidv7 } from '@lore/shared/ids';
import { type InfiniteData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { ChatComposer } from '@/components/ui/ChatComposer';
import { MessageBubble, type BubblePosition } from '@/components/ui/MessageBubble';
import { ReactionBar } from '@/components/ui/ReactionBar';
import { Sheet, SheetAction } from '@/components/ui/Sheet';
import { cardRegistry } from '@/features/chat/cards/registry';
import { toolbarRegistry } from '@/features/chat/toolbar/registry';
import type { ToolbarContext } from '@/features/chat/toolbar/types';
import { WhySheet } from '@/features/persona/WhySheet';
import { GamesSheet } from '@/features/games/GamesSheet';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';
import { joinRoom, onEvent, sendTyping } from '@/lib/socket';
import { toast } from '@/lib/store';
import { clock, dayLabel } from '@/lib/time';
import { uploadFile } from '@/lib/upload';
import { type MsgPage, flatMessages, patchMessage, upsertMessage } from './realtime';
import { LiveCaption, RecordingBar, useVoiceRecorder } from './VoiceRecorder';
import { VoicePlayer } from './VoicePlayer';

type Pending = MessageDTO & { _pending?: boolean; _failed?: boolean; _retry?: () => void };
type Row =
  | { type: 'day'; key: string; label: string }
  | {
      type: 'msg';
      key: string;
      msg: Pending;
      position: BubblePosition;
      showAvatar: boolean;
      showName: boolean;
      time?: string;
    };

const GROUP_MS = 5 * 60_000;

export function ChatPage({ id }: { id: string }) {
  return (
    <Suspense>
      <Chat id={id} />
    </Suspense>
  );
}

/** Conversation view [C1] (sections 8.2, 9.2). */
function Chat({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const me = useMe();
  const meId = me.data?.user.id ?? '';
  const conv = useQuery({
    queryKey: qk.conversation(id),
    queryFn: () => api.get<ConversationDTO>(`/v1/conversations/${id}`),
    retry: false,
  });
  const msgs = useInfiniteQuery({
    queryKey: qk.messages(id),
    queryFn: ({ pageParam }) =>
      api.get<MsgPage>(`/v1/conversations/${id}/messages${pageParam ? `?before=${pageParam}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (l) => l.nextCursor ?? undefined,
    enabled: !conv.error,
  });
  const [pending, setPending] = useState<Pending[]>([]);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [replyTo, setReplyTo] = useState<MessageDTO | null>(null);
  const [reacting, setReacting] = useState<{ msg: MessageDTO; rect: DOMRect } | null>(null);
  const [why, setWhy] = useState<MessageDTO | null>(null);
  const [sparkle, setSparkle] = useState(false);
  const [games, setGames] = useState(params.get('games') === '1');
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  // realtime: join room, apply reducers, backfill after reconnect
  useEffect(() => {
    const leave = joinRoom(`conv:${id}`);
    const offs = [
      onEvent('message.created', (e) => {
        if (e.data.conversationId !== id) return;
        upsertMessage(qc, e.data);
        setPending((p) => p.filter((x) => x.clientId !== e.data.clientId));
        if (e.data.sender?.userId !== meId) void api.post(`/v1/conversations/${id}/read`).catch(() => {});
      }),
      onEvent(
        'message.updated',
        (e) =>
          e.data.conversationId === id &&
          patchMessage(qc, id, e.data.id, e.data.patch as Partial<MessageDTO>),
      ),
      onEvent('typing', (e) => {
        if (e.data.conversationId !== id || e.data.userId === meId) return;
        setTyping((t) => ({ ...t, [e.data.userId]: e.data.on ? Date.now() : 0 }));
        if (!e.data.on) qc.invalidateQueries({ queryKey: qk.conversation(id) });
      }),
      onEvent(
        'ai.typing',
        (e) =>
          e.data.conversationId === id &&
          setTyping((t) => ({ ...t, [`ai:${e.data.personaId}`]: e.data.on ? Date.now() : 0 })),
      ),
    ];
    const backfill = async () => {
      const all = flatMessages(qc.getQueryData<InfiniteData<MsgPage>>(qk.messages(id)));
      const last = all[all.length - 1];
      if (!last) return;
      const r = await api.get<MsgPage>(`/v1/conversations/${id}/messages?after=${last.id}`).catch(() => null);
      r?.items.forEach((m) => upsertMessage(qc, m));
    };
    window.addEventListener('lore:socket-connected', backfill);
    void api.post(`/v1/conversations/${id}/read`).catch(() => {});
    return () => {
      leave();
      offs.forEach((o) => o());
      window.removeEventListener('lore:socket-connected', backfill);
    };
  }, [id, qc, meId]);

  useEffect(() => {
    const t = setInterval(
      () =>
        setTyping((x) =>
          Object.fromEntries(Object.entries(x).filter(([, at]) => at && Date.now() - at < 6000)),
        ),
      2000,
    );
    return () => clearInterval(t);
  }, []);

  const all = useMemo(() => [...flatMessages(msgs.data), ...pending], [msgs.data, pending]);
  const isGroup = conv.data?.kind === 'group';

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    all.forEach((m, i) => {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        out.push({ type: 'day', key: `d-${day}`, label: dayLabel(m.createdAt) });
        lastDay = day;
      }
      const prev = all[i - 1];
      const next = all[i + 1];
      const who = (x?: MessageDTO) => (x ? `${x.senderType}:${x.sender?.userId ?? x.persona?.id ?? ''}` : '');
      const same = (a?: MessageDTO, b?: MessageDTO) =>
        a &&
        b &&
        who(a) === who(b) &&
        a.senderType !== 'system' &&
        Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) < GROUP_MS &&
        new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString();
      const withPrev = same(prev, m);
      const withNext = same(m, next);
      const position: BubblePosition =
        withPrev && withNext ? 'middle' : withPrev ? 'last' : withNext ? 'first' : 'single';
      const gap = prev && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 60 * 60_000;
      out.push({
        type: 'msg',
        key: m.id,
        msg: m,
        position,
        showAvatar: !withNext,
        showName: Boolean(isGroup || m.senderType === 'ai') && !withPrev,
        time: gap ? clock(m.createdAt) : undefined,
      });
    });
    return out;
  }, [all, isGroup]);

  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 56,
    overscan: 12,
    getItemKey: (i) => rows[i].key,
  });

  // stay pinned to the bottom on new messages (when already near it)
  const prevCount = useRef(0);
  const firstKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !rows.length) return;
    const newFirst = rows[0]?.key ?? null;
    if (prevCount.current === 0) virt.scrollToIndex(rows.length - 1, { align: 'end' });
    else if (firstKey.current && newFirst !== firstKey.current) {
      // older page prepended: keep the visible message in place
      const idx = rows.findIndex((r) => r.key === firstKey.current);
      if (idx > 0) virt.scrollToIndex(idx, { align: 'start' });
    } else if (rows.length > prevCount.current && atBottom.current)
      virt.scrollToIndex(rows.length - 1, { align: 'end' });
    prevCount.current = rows.length;
    firstKey.current = newFirst;
  }, [rows, virt]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 200 && msgs.hasNextPage && !msgs.isFetchingNextPage) void msgs.fetchNextPage();
  };

  const optimistic = useCallback(
    (partial: Partial<MessageDTO>): Pending => ({
      id: `pending-${uuidv7()}`,
      conversationId: id,
      clientId: uuidv7(),
      createdAt: new Date().toISOString(),
      senderType: 'human',
      sender: me.data?.personalAccount
        ? {
            userId: meId,
            displayName: me.data.personalAccount.displayName,
            handle: me.data.personalAccount.handle,
            avatarUrl: me.data.personalAccount.avatarUrl,
          }
        : null,
      persona: null,
      kind: 'text',
      body: null,
      media: [],
      cardKind: null,
      cardRefId: null,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            body: replyTo.body,
            senderName: replyTo.sender?.displayName ?? replyTo.persona?.name ?? '',
          }
        : null,
      aiGenerated: false,
      meta: {},
      reactions: [],
      editedAt: null,
      deletedAt: null,
      _pending: true,
      ...partial,
    }),
    [id, me.data, meId, replyTo],
  );

  const deliver = useCallback(
    async (p: Pending, body: Record<string, unknown>) => {
      setPending((xs) => [...xs, p]);
      atBottom.current = true;
      const attempt = async () => {
        setPending((xs) => xs.map((x) => (x.clientId === p.clientId ? { ...x, _failed: false } : x)));
        try {
          const m = await api.post<MessageDTO>(`/v1/conversations/${id}/messages`, {
            clientId: p.clientId,
            ...body,
          });
          upsertMessage(qc, m);
          setPending((xs) => xs.filter((x) => x.clientId !== p.clientId));
        } catch (e) {
          setPending((xs) =>
            xs.map((x) => (x.clientId === p.clientId ? { ...x, _failed: true, _retry: attempt } : x)),
          );
          if ((e as { status?: number }).status === 403) toast((e as Error).message, 'error');
        }
      };
      await attempt();
    },
    [id, qc],
  );

  const sendText = (text: string) => {
    const p = optimistic({ kind: 'text', body: text });
    void deliver(p, { kind: 'text', body: text, replyToId: replyTo?.id });
    setReplyTo(null);
  };

  const sendMedia = async (files: File[]) => {
    const local = files.map((f) => ({
      id: uuidv7(),
      url: URL.createObjectURL(f),
      kind: f.type.startsWith('video') ? 'video' : 'image',
    })) as unknown as MediaDTO[];
    const p = optimistic({
      kind: 'media',
      media: local.map((m) => ({
        ...m,
        thumbUrl: null,
        mime: '',
        width: null,
        height: null,
        durationMs: null,
        blurhash: null,
        aiGenerated: false,
        generator: null,
        transcript: null,
        transcriptStatus: 'none',
      })),
    });
    setPending((xs) => [...xs, p]);
    try {
      const uploaded = await Promise.all(
        files.map((f) => uploadFile(f, f.type.startsWith('video') ? 'video' : 'image')),
      );
      setPending((xs) => xs.filter((x) => x.clientId !== p.clientId));
      await deliver({ ...p, media: uploaded }, { kind: 'media', mediaIds: uploaded.map((u) => u.id) });
    } catch (e) {
      setPending((xs) => xs.filter((x) => x.clientId !== p.clientId));
      toast((e as Error).message, 'error');
    }
  };

  const voice = useVoiceRecorder(async (blob, durationMs, waveform) => {
    const p = optimistic({ kind: 'voice', meta: { waveform } });
    setPending((xs) => [...xs, p]);
    try {
      const m = await uploadFile(
        new File([blob], 'voice.webm', { type: blob.type || 'audio/webm' }),
        'audio',
      );
      setPending((xs) => xs.filter((x) => x.clientId !== p.clientId));
      await deliver(
        { ...p, media: [{ ...m, durationMs: m.durationMs ?? durationMs }] },
        { kind: 'voice', mediaIds: [m.id], meta: { waveform, durationMs } },
      );
    } catch (e) {
      setPending((xs) => xs.filter((x) => x.clientId !== p.clientId));
      toast((e as Error).message, 'error');
    }
  });

  const react = async (msg: MessageDTO, emoji: string) => {
    setReacting(null);
    const mine = msg.reactions.find((r) => r.userIds.includes(meId));
    if (mine?.emoji === emoji) await api.del(`/v1/messages/${msg.id}/reactions/${encodeURIComponent(emoji)}`);
    else await api.post(`/v1/messages/${msg.id}/reactions`, { emoji });
  };

  const ctx: ToolbarContext = {
    conversationId: id,
    meUserId: meId,
    isGroup: Boolean(isGroup),
    push: (href) => router.push(href),
    openSheet: (sheet) => {
      if (sheet === 'games') setGames(true);
      if (sheet === 'voice') toast('Hold the mic to record');
    },
  };

  if (conv.error) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-bg">
        <p className="text-[18px] font-bold">You can't view this chat</p>
        <Link href="/inbox" className="font-semibold text-action">
          Back to messages
        </Link>
      </div>
    );
  }

  const c = conv.data;
  const others = c?.members.filter((m) => m.userId !== meId) ?? [];
  const lastOwn = [...all]
    .reverse()
    .find((m) => m.sender?.userId === meId && !('_pending' in m && m._pending));
  const seen =
    c?.kind === 'dm' && lastOwn && others.some((o) => o.lastReadAt && o.lastReadAt >= lastOwn.createdAt);
  const typers = Object.keys(typing).filter((k) => typing[k]);
  const headerActions = toolbarRegistry.filter((a) => a.placements.includes('header'));

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg md:static md:h-dvh">
      <header className="chrome z-20 border-b hairline bg-bg pt-safe">
        <div className="flex h-[52px] items-center gap-2 px-2">
          <button type="button" aria-label="Back" onClick={() => router.back()} className="press p-1">
            <ChevronLeft size={28} />
          </button>
          <Link href={`/c/${id}/details`} className="press flex min-w-0 flex-1 items-center gap-2.5">
            {c?.kind === 'group' ? (
              <AvatarStack srcs={others.map((o) => o.avatarUrl)} size={32} />
            ) : (
              <Avatar src={c?.avatarUrl} name={c?.title} size={32} />
            )}
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[16px] font-semibold">{c?.title ?? ' '}</span>
              <span className="block truncate text-[12px] text-ink-2">
                {c?.kind === 'group'
                  ? `${c.members.length} members${c.persona?.enabled ? ` · ${c.persona.name} (AI)` : ''}`
                  : (others[0]?.handle ?? '')}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4 pr-2">
            {headerActions.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={a.label}
                onClick={() => a.run(ctx)}
                className="press"
              >
                <a.icon size={24} strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </div>
      </header>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="relative flex-1 overflow-y-auto overscroll-contain"
        aria-live="polite"
        data-scroll
      >
        {msgs.isFetchingNextPage && <p className="py-2 text-center text-[12px] text-ink-2">Loading…</p>}
        {!msgs.isLoading && all.length === 0 && c && (
          <div className="flex flex-col items-center gap-2 pt-16 text-center">
            {c.kind === 'group' ? (
              <AvatarStack srcs={others.map((o) => o.avatarUrl)} size={86} />
            ) : (
              <Avatar src={c.avatarUrl} name={c.title} size={86} />
            )}
            <p className="text-[18px] font-semibold">{c.title}</p>
            <p className="text-ink-2">Say hi 👋</p>
          </div>
        )}
        <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
          {virt.getVirtualItems().map((vi) => {
            const r = rows[vi.index];
            return (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virt.measureElement}
                className="absolute inset-x-0"
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                {r.type === 'day' ? (
                  <p className="py-3 text-center text-[12px] font-semibold text-ink-2">{r.label}</p>
                ) : (
                  <>
                    {r.time && <p className="pt-3 text-center text-[11px] text-ink-2">{r.time}</p>}
                    <MessageBubble
                      msg={r.msg}
                      own={r.msg.sender?.userId === meId && r.msg.senderType === 'human'}
                      position={r.position}
                      showAvatar={r.showAvatar}
                      showName={r.showName}
                      pending={r.msg._pending && !r.msg._failed}
                      failed={r.msg._failed}
                      onRetry={r.msg._retry}
                      onLongPress={(rect) => !r.msg._pending && setReacting({ msg: r.msg, rect })}
                      onReply={() => setReplyTo(r.msg)}
                      onDoubleTap={() => !r.msg._pending && react(r.msg, '❤️')}
                      onWhy={r.msg.senderType === 'ai' ? () => setWhy(r.msg) : undefined}
                      cardSlot={
                        r.msg.kind === 'card' && r.msg.cardKind ? <CardSlot msg={r.msg} meId={meId} /> : null
                      }
                      voiceSlot={
                        r.msg.media[0] ? (
                          <VoicePlayer
                            media={r.msg.media[0]}
                            waveform={r.msg.meta.waveform}
                            own={r.msg.sender?.userId === meId}
                          />
                        ) : null
                      }
                    />
                    {lastOwn?.id === r.msg.id && seen && (
                      <p className="pr-4 pt-1 text-right text-[11px] text-ink-2">Seen</p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {typers.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2" aria-live="polite">
            <span
              className={cn(
                'flex gap-1 rounded-full px-3 py-2.5',
                typers.some((t) => t.startsWith('ai:')) ? 'bg-ai-tint' : 'bg-surface-2',
              )}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-2"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
          </div>
        )}
        <div className="h-2" />
      </div>

      <ChatComposer
        onSend={sendText}
        onTyping={(on) => sendTyping(id, on)}
        onPickMedia={sendMedia}
        onSparkle={() => setSparkle(true)}
        onMicDown={voice.begin}
        recording={voice.recording}
        voiceSlot={
          <RecordingBar
            elapsed={voice.elapsed}
            levels={voice.levels}
            cancelArmed={voice.cancelArmed}
            onCancel={() => voice.stop(true)}
          />
        }
        aboveSlot={
          voice.recording ? (
            <LiveCaption stream={voice.stream} active={voice.recording} conversationId={id} />
          ) : null
        }
        replyTo={
          replyTo
            ? { name: replyTo.sender?.displayName ?? replyTo.persona?.name ?? '', body: replyTo.body }
            : null
        }
        onCancelReply={() => setReplyTo(null)}
      />

      {reacting && (
        <button
          type="button"
          aria-label="Close reactions"
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
          onClick={() => setReacting(null)}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: Math.max(80, reacting.rect.top - 64) }}
            onClick={(e) => e.stopPropagation()}
          >
            <ReactionBar
              onPick={(e) => react(reacting.msg, e)}
              onReply={() => {
                setReplyTo(reacting.msg);
                setReacting(null);
              }}
            />
          </div>
        </button>
      )}
      <Sheet open={sparkle} onOpenChange={setSparkle} title="✦">
        <div className="pb-6">
          {toolbarRegistry
            .filter((a) => a.placements.includes('sparkle'))
            .map((a) => (
              <SheetAction
                key={a.id}
                icon={<a.icon size={22} />}
                onClick={() => {
                  setSparkle(false);
                  void a.run(ctx);
                }}
              >
                {a.label}
              </SheetAction>
            ))}
        </div>
      </Sheet>
      {why && (
        <WhySheet
          open
          onOpenChange={(v) => !v && setWhy(null)}
          conversationId={id}
          messageId={why.id}
          reason={why.meta.reason}
          memoryIds={why.meta.memoryIdsUsed}
        />
      )}
      <GamesSheet open={games} onOpenChange={setGames} conversationId={id} />
    </div>
  );
}

function CardSlot({ msg, meId }: { msg: MessageDTO; meId: string }) {
  const Comp = cardRegistry[msg.cardKind as CardKind];
  if (!Comp)
    return <div className="rounded-2xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2">Unsupported card</div>;
  return <Comp message={msg} data={msg.card as never} conversationId={msg.conversationId} meUserId={meId} />;
}
