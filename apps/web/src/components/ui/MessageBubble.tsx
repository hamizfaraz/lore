'use client';
import type { MessageDTO } from '@lore/shared/dto/chat';
import { useDrag } from '@use-gesture/react';
import { CornerUpLeft } from 'lucide-react';
import { useRef, useState } from 'react';
import { tap } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { Avatar } from './Avatar';
import { BlurImage } from './BlurImage';
import { AiPill } from './Labels';

export type BubblePosition = 'single' | 'first' | 'middle' | 'last';

/**
 * Message bubble: own (right, --action), other (left, --surface-2), AI (--ai-tint + persona avatar + AI pill),
 * system (centered). Grouped corners like Instagram; long-press → reactions; swipe left → reply; double-tap → ❤️.
 */
export function MessageBubble({
  msg,
  own,
  position,
  showAvatar,
  showName,
  onLongPress,
  onReply,
  onDoubleTap,
  onWhy,
  cardSlot,
  voiceSlot,
  pending,
  failed,
  onRetry,
}: {
  msg: MessageDTO;
  own: boolean;
  position: BubblePosition;
  showAvatar: boolean;
  showName: boolean;
  onLongPress?: (rect: DOMRect) => void;
  onReply?: () => void;
  onDoubleTap?: () => void;
  onWhy?: () => void;
  cardSlot?: React.ReactNode;
  voiceSlot?: React.ReactNode;
  pending?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const isAi = msg.senderType === 'ai';

  const bind = useDrag(
    ({ movement: [mx], last }) => {
      const v = Math.min(0, Math.max(-70, mx));
      if (last) {
        if (v < -50) {
          tap();
          onReply?.();
        }
        setDx(0);
      } else setDx(v);
    },
    { axis: 'x', filterTaps: true, pointer: { touch: true } },
  );

  if (msg.senderType === 'system') {
    return <p className="mx-auto max-w-[80%] py-2 text-center text-[12px] text-ink-2">{msg.body}</p>;
  }

  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      tap();
      if (ref.current) onLongPress?.(ref.current.getBoundingClientRect());
    }, 420);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };
  const onClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) onDoubleTap?.();
    lastTap.current = now;
  };

  const r = 'rounded-[22px]';
  const corners = own
    ? { single: '', first: 'rounded-br-[6px]', middle: 'rounded-r-[6px]', last: 'rounded-tr-[6px]' }[position]
    : { single: '', first: 'rounded-bl-[6px]', middle: 'rounded-l-[6px]', last: 'rounded-tl-[6px]' }[
        position
      ];
  const tone = own
    ? 'bg-action text-white shadow-sm'
    : isAi
      ? 'bg-ai-tint text-ink border border-ai/25 shadow-sm'
      : 'bg-surface-2 text-ink border border-line/40';
  const media = msg.media.filter((m) => m.kind !== 'audio');
  const name = isAi ? msg.persona?.name : msg.sender?.displayName;

  return (
    <div
      className={cn(
        'group flex w-full items-end gap-2 px-3',
        own ? 'justify-end' : 'justify-start',
        position === 'first' || position === 'single' ? 'mt-2' : 'mt-[2px]',
      )}
    >
      {!own && (
        <span className="w-7 shrink-0">
          {showAvatar && (
            <Avatar
              src={isAi ? msg.persona?.avatarUrl : msg.sender?.avatarUrl}
              name={name}
              size={28}
              ai={isAi}
            />
          )}
        </span>
      )}
      <div
        className={cn('flex max-w-[75%] flex-col', own ? 'items-end' : 'items-start')}
        style={{ transform: `translateX(${dx}px)` }}
        {...bind()}
      >
        {showName && !own && (
          <span className="mb-0.5 ml-3 flex items-center gap-1 text-[12px] text-ink-2">
            {name}
            {isAi && <AiPill />}
          </span>
        )}
        {msg.replyTo && (
          <div
            className={cn(
              'mb-[-8px] max-w-full rounded-[18px] border hairline px-3 pb-3 pt-1.5 text-[12px] text-ink-2',
              own ? 'mr-1' : 'ml-1',
            )}
          >
            <span className="font-semibold">{msg.replyTo.senderName}</span>:{' '}
            <span className="line-clamp-2">{msg.replyTo.body ?? 'Attachment'}</span>
          </div>
        )}
        <div
          ref={ref}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onContextMenu={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn('relative select-none', pending && 'opacity-60')}
        >
          {msg.kind === 'card' && cardSlot}
          {media.length > 0 && (
            <div
              className={cn(
                'grid gap-0.5 overflow-hidden',
                r,
                media.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
              )}
              style={{ width: media.length > 1 ? 240 : 220 }}
            >
              {media.slice(0, 4).map((m) => (
                <div key={m.id} className="relative aspect-square">
                  {m.kind === 'video' ? (
                    <video src={m.url} className="h-full w-full object-cover" playsInline controls />
                  ) : (
                    <BlurImage src={m.thumbUrl ?? m.url} blurhash={m.blurhash} />
                  )}
                  {m.aiGenerated && <AiPill className="absolute bottom-1.5 left-1.5" />}
                </div>
              ))}
            </div>
          )}
          {msg.kind === 'voice' && voiceSlot}
          {msg.body && msg.kind !== 'card' && (
            <div
              className={cn(
                'whitespace-pre-wrap break-words px-3 py-2 text-[15px] leading-[20px]',
                r,
                corners,
                tone,
                media.length > 0 && 'mt-0.5',
              )}
            >
              {msg.body}
            </div>
          )}
          {msg.reactions.length > 0 && (
            <span
              className={cn(
                'absolute -bottom-3 flex items-center gap-0.5 rounded-full border-2 border-bg bg-surface-2 px-1.5 text-[12px] leading-5',
                own ? 'right-2' : 'left-2',
              )}
            >
              {msg.reactions.map((x) => x.emoji).join('')}
              {msg.reactions.reduce((a, x) => a + x.userIds.length, 0) > 1 && (
                <span className="text-ink-2">{msg.reactions.reduce((a, x) => a + x.userIds.length, 0)}</span>
              )}
            </span>
          )}
        </div>
        {isAi && onWhy && (position === 'last' || position === 'single') && (
          <button
            type="button"
            onClick={onWhy}
            className="press ml-3 mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-ai-tint text-[11px] font-semibold text-ai border border-ai/20 hover:bg-ai/10 transition"
          >
            Why?{msg.meta.degraded ? ' · degraded' : ''}
            {msg.meta.demoTiming ? ' · demo timing' : ''}
          </button>
        )}
        {failed && (
          <button type="button" onClick={onRetry} className="mt-1 text-[12px] text-heart">
            Not sent. Tap to retry
          </button>
        )}
      </div>
      {dx < -10 && <CornerUpLeft size={18} className="absolute right-2 text-ink-2" />}
    </div>
  );
}
