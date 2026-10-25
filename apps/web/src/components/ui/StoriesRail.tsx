'use client';
import type { StoryRailItemDTO } from '@lore/shared/dto/social';
import { Plus, Sparkles } from 'lucide-react';
import { Avatar } from './Avatar';
import { StoryRing } from './StoryRing';

/** Stories rail: "Your story" with blue plus, then authors (group stories with the green ring). */
export function StoriesRail({
  items,
  me,
  onOpen,
  onCreate,
  planBubble,
}: {
  items: StoryRailItemDTO[];
  me?: { avatarUrl: string | null; displayName: string; id: string } | null;
  onOpen: (accountId: string) => void;
  onCreate: () => void;
  planBubble?: { label: string; onOpen: () => void } | null;
}) {
  const mine = items.find((i) => i.author.id === me?.id);
  const others = items.filter((i) => i.author.id !== me?.id);
  return (
    <div className="chrome border-b border-line/60 bg-surface-2/30 px-3.5 py-3">
      <ul className="flex items-center gap-3.5 overflow-x-auto" aria-label="Stories">
        {planBubble && (
          <li className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={planBubble.onOpen}
              className="press rounded-full p-[2px] transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full border-2 border-bg bg-ai-tint text-ai shadow-sm">
                <Sparkles size={24} />
              </span>
            </button>
            <span className="w-full truncate text-center text-[11px] font-medium text-ai">
              {planBubble.label}
            </span>
          </li>
        )}
        {me && (
          <li className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
            <div className="relative">
              {mine ? (
                <StoryRing
                  src={me.avatarUrl}
                  name={me.displayName}
                  state={mine.allSeen ? 'seen' : 'unseen'}
                  onClick={() => onOpen(me.id)}
                />
              ) : (
                <button
                  type="button"
                  onClick={onCreate}
                  className="press block rounded-full p-[3px] ring-1 ring-line/80 transition-transform active:scale-95"
                >
                  <Avatar src={me.avatarUrl} name={me.displayName} size={58} />
                </button>
              )}
              <button
                type="button"
                aria-label="Add to your story"
                onClick={onCreate}
                className="absolute -bottom-1 -right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-action text-white shadow-sm ring-2 ring-bg"
              >
                <Plus size={13} strokeWidth={3} />
              </button>
            </div>
            <span className="w-full truncate text-center text-[11px] font-medium text-ink-2">
              Your circle
            </span>
          </li>
        )}
        {others.map((it) => (
          <li key={it.author.id} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
            <div className="relative">
              <StoryRing
                src={it.author.avatarUrl}
                name={it.author.displayName}
                group={it.isGroup}
                state={it.allSeen ? 'seen' : 'unseen'}
                onClick={() => onOpen(it.author.id)}
              />
              {it.isGroup && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] text-white ring-2 ring-bg font-bold">
                  G
                </span>
              )}
            </div>
            <span className="w-full truncate text-center text-[11px] font-medium text-ink">
              {it.author.handle}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
