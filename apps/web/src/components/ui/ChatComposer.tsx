'use client';
import { Camera, Image as ImageIcon, Mic, Sparkles, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useKeyboardInset } from '@/lib/hooks';
import { cn } from '@/lib/cn';

/**
 * Composer: camera circle left, "Message…" pill, mic, gallery, ✦ sparkle right (section 9.2).
 * Tracks visualViewport so it sits on top of the iOS keyboard. Voice recording is rendered by `voiceSlot`.
 */
export function ChatComposer({
  onSend,
  onTyping,
  onPickMedia,
  onCamera,
  onSparkle,
  onMicDown,
  replyTo,
  onCancelReply,
  voiceSlot,
  recording,
  disabled,
  aboveSlot,
}: {
  onSend: (text: string) => void;
  onTyping?: (on: boolean) => void;
  onPickMedia: (files: File[]) => void;
  onCamera?: () => void;
  onSparkle?: () => void;
  onMicDown?: (e: React.PointerEvent) => void;
  replyTo?: { name: string; body: string | null } | null;
  onCancelReply?: () => void;
  voiceSlot?: React.ReactNode;
  recording?: boolean;
  disabled?: boolean;
  aboveSlot?: React.ReactNode;
}) {
  const [text, setText] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const typingT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inset = useKeyboardInset();

  const change = (v: string) => {
    setText(v);
    onTyping?.(true);
    if (typingT.current) clearTimeout(typingT.current);
    typingT.current = setTimeout(() => onTyping?.(false), 2500);
  };
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
    onTyping?.(false);
  };

  return (
    <div
      className="chrome sticky bottom-0 z-20 bg-bg pb-safe"
      style={{ transform: inset ? `translateY(-${inset}px)` : undefined }}
    >
      {aboveSlot}
      {replyTo && (
        <div className="flex items-center gap-2 border-t hairline px-4 py-2 text-[13px]">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Replying to {replyTo.name}</p>
            <p className="truncate text-ink-2">{replyTo.body ?? 'Attachment'}</p>
          </div>
          <button type="button" aria-label="Cancel reply" onClick={onCancelReply} className="press">
            <X size={18} />
          </button>
        </div>
      )}
      <div className="px-3 py-2">
        <div
          className={cn(
            'flex min-h-[44px] items-center gap-2 rounded-[22px] bg-surface-2 py-1 pl-1 pr-3',
            recording && 'bg-ai-tint',
          )}
        >
          {recording ? (
            voiceSlot
          ) : (
            <>
              <button
                type="button"
                aria-label="Camera"
                onClick={onCamera ?? (() => file.current?.click())}
                className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-action text-white"
              >
                <Camera size={20} />
              </button>
              <textarea
                rows={1}
                value={text}
                disabled={disabled}
                onChange={(e) => change(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Message…"
                aria-label="Message"
                className="max-h-28 min-w-0 flex-1 resize-none bg-transparent py-2 text-[16px] leading-5 outline-none placeholder:text-ink-2"
              />
              {text.trim() ? (
                <button type="button" onClick={send} className="press font-semibold text-action">
                  Send
                </button>
              ) : (
                <div className="flex items-center gap-3.5 text-ink">
                  <button
                    type="button"
                    aria-label="Hold to record a voice note"
                    onPointerDown={onMicDown}
                    className="press touch-none"
                  >
                    <Mic size={24} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    aria-label="Photo or video"
                    onClick={() => file.current?.click()}
                    className="press"
                  >
                    <ImageIcon size={24} strokeWidth={1.75} />
                  </button>
                  <button type="button" aria-label="Ask Milo" onClick={onSparkle} className="press text-ai">
                    <Sparkles size={24} strokeWidth={1.75} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onPickMedia(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
