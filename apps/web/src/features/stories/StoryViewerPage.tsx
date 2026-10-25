'use client';
import type { ConversationDTO } from '@lore/shared/dto/chat';
import type { StoryDTO, StoryRailItemDTO } from '@lore/shared/dto/social';
import type { AccountSummaryDTO } from '@lore/shared/dto/users';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDrag } from '@use-gesture/react';
import { Heart, MoreHorizontal, Send, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { AiPill } from '@/components/ui/Labels';
import { api } from '@/lib/api';
import { tap } from '@/lib/haptics';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import { ago } from '@/lib/time';

const DURATION = 5000;

/**
 * Story viewer [C1]: zooms open, segmented progress bars, tap right/left, hold to pause, swipe down to
 * close, "Send message" reply that lands in the DM (section 9.2). Advances to the next author in the rail.
 */
export function StoryViewerPage({ accountId }: { accountId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const q = useQuery({
    queryKey: qk.stories(accountId),
    queryFn: () =>
      api.get<{ author: AccountSummaryDTO; stories: StoryDTO[] }>(`/v1/stories/by-account/${accountId}`),
  });
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [dy, setDy] = useState(0);
  const raf = useRef<number | null>(null);
  const started = useRef(0);
  const elapsed = useRef(0);
  const stories = q.data?.stories ?? [];
  const story = stories[i];

  const close = useCallback(() => {
    qc.invalidateQueries({ queryKey: qk.storiesRail });
    router.back();
  }, [qc, router]);

  const nextAuthor = useCallback(() => {
    const rail = qc.getQueryData<StoryRailItemDTO[]>(qk.storiesRail) ?? [];
    const idx = rail.findIndex((r) => r.author.id === accountId);
    const next = rail.slice(idx + 1).find((r) => !r.allSeen) ?? rail[idx + 1];
    if (next) router.replace(`/stories/${next.author.id}`);
    else close();
  }, [qc, accountId, router, close]);

  const go = useCallback(
    (d: 1 | -1) => {
      elapsed.current = 0;
      setProgress(0);
      if (d === 1) {
        if (i + 1 < stories.length) setI(i + 1);
        else nextAuthor();
      } else setI(Math.max(0, i - 1));
    },
    [i, stories.length, nextAuthor],
  );

  useEffect(() => {
    if (!story) return;
    void api.post(`/v1/stories/${story.id}/view`).catch(() => {});
  }, [story]);

  useEffect(() => {
    if (!story || paused) return;
    started.current = performance.now() - elapsed.current;
    const step = (t: number) => {
      elapsed.current = t - started.current;
      const p = Math.min(1, elapsed.current / DURATION);
      setProgress(p);
      if (p >= 1) go(1);
      else raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [story, paused, go]);

  const bind = useDrag(
    ({ movement: [, my], last, tap: isTap, event }) => {
      if (isTap) return;
      if (last) {
        if (my > 120) close();
        setDy(0);
        setPaused(false);
      } else {
        setPaused(true);
        setDy(Math.max(0, my));
      }
      event?.stopPropagation?.();
    },
    { axis: 'y', filterTaps: true },
  );

  const sendReply = async (text: string) => {
    const author = q.data?.author;
    if (!author || !text.trim()) return;
    try {
      let convId: string;
      if (author.type === 'group' && author.conversationId) convId = author.conversationId;
      else {
        const owner = await api.get<{ userId: string }>(`/v1/accounts/${author.id}/owner`);
        convId = (
          await api.post<ConversationDTO>('/v1/conversations', { kind: 'dm', memberUserIds: [owner.userId] })
        ).id;
      }
      await api.post(`/v1/conversations/${convId}/messages`, {
        clientId: crypto.randomUUID(),
        kind: 'text',
        body: text.trim(),
        meta: { storyId: story?.id, storyThumbUrl: story?.media.thumbUrl },
      });
      setReply('');
      toast('Sent');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  if (!q.data) return <div className="fixed inset-0 z-50 bg-black" />;
  if (!stories.length) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white">
        <button type="button" onClick={close}>
          No active stories · Close
        </button>
      </div>
    );
  }
  const isOwn = me.data?.personalAccount?.id === accountId;

  return (
    <motion.div
      initial={{ scale: 0.3, opacity: 0, borderRadius: 999 }}
      animate={{ scale: 1 - dy / 2000, opacity: 1, borderRadius: dy ? 16 : 0, y: dy }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className="chrome fixed inset-0 z-50 overflow-hidden bg-black text-white md:inset-x-auto md:left-1/2 md:w-[420px] md:-translate-x-1/2"
      {...(bind() as any)}
      style={{ touchAction: 'none' }}
    >
      <div
        className="absolute inset-0"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
      >
        <img
          src={story.media.url}
          alt={story.caption ?? ''}
          className="h-full w-full object-cover"
          draggable={false}
        />
        {story.media.aiGenerated && <AiPill className="absolute bottom-24 left-3" label="AI image" />}
      </div>
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent px-2 pb-6 pt-[calc(var(--safe-top)+8px)]">
        <div className="flex gap-1">
          {stories.map((s, k) => (
            <span key={s.id} className="h-[2px] flex-1 overflow-hidden rounded bg-white/35">
              <span
                className="block h-full bg-white"
                style={{ width: `${k < i ? 100 : k === i ? progress * 100 : 0}%` }}
              />
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 px-1">
          <Avatar src={q.data.author.avatarUrl} name={q.data.author.displayName} size={32} />
          <span className="text-[14px] font-semibold">{q.data.author.handle}</span>
          <span className="text-[14px] opacity-70">{ago(story.createdAt)}</span>
          <MoreHorizontal size={22} className="ml-auto" />
          <button type="button" aria-label="Close" onClick={close} className="press">
            <X size={28} />
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Previous"
        className="absolute inset-y-0 left-0 w-1/3"
        onClick={() => go(-1)}
      />
      <button
        type="button"
        aria-label="Next"
        className="absolute inset-y-0 right-0 w-2/3"
        onClick={() => go(1)}
      />
      {story.caption && (
        <p className="absolute inset-x-6 bottom-28 text-center text-[17px] font-semibold drop-shadow">
          {story.caption}
        </p>
      )}
      {!isOwn && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-3 pb-[calc(var(--safe-bottom)+10px)] pt-3">
          <input
            value={reply}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendReply(reply)}
            placeholder="Send message"
            className="h-[44px] flex-1 rounded-full border border-white/60 bg-transparent px-4 text-[16px] text-white outline-none placeholder:text-white/80"
          />
          <button
            type="button"
            aria-label="Like"
            className="press"
            onClick={() => {
              tap();
              void sendReply('❤️');
            }}
          >
            <Heart size={26} />
          </button>
          <button type="button" aria-label="Send" className="press" onClick={() => sendReply(reply)}>
            <Send size={24} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
