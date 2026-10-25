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
    <ul className="chrome flex gap-3.5 overflow-x-auto px-3 pb-2 pt-1.5" aria-label="Stories">
      {planBubble && (
        <li className="flex w-[68px] shrink-0 flex-col items-center gap-1">
          <button type="button" onClick={planBubble.onOpen} className="press rounded-full bg-ai p-[2px]">
            <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-bg bg-ai-tint text-ai">
              <Sparkles size={26} />
            </span>
          </button>
          <span className="w-full truncate text-center text-[12px]">{planBubble.label}</span>
        </li>
      )}
      {me && (
        <li className="flex w-[68px] shrink-0 flex-col items-center gap-1">
          <div className="relative">
            {mine ? (
              <StoryRing
                src={me.avatarUrl}
                name={me.displayName}
                state={mine.allSeen ? 'seen' : 'unseen'}
                onClick={() => onOpen(me.id)}
              />
            ) : (
              <button type="button" onClick={onCreate} className="press block p-[4px]">
                <Avatar src={me.avatarUrl} name={me.displayName} size={60} />
              </button>
            )}
            <button
              type="button"
              aria-label="Add to your story"
              onClick={onCreate}
              className="absolute -bottom-2.5 -right-2.5 flex h-[44px] w-[44px] items-center justify-center"
            >
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-bg bg-action text-white">
                <Plus size={14} strokeWidth={3} />
              </span>
            </button>
          </div>
          <span className="w-full truncate text-center text-[12px] text-ink-2">Your story</span>
        </li>
      )}
      {others.map((it) => (
        <li key={it.author.id} className="flex w-[68px] shrink-0 flex-col items-center gap-1">
          <StoryRing
            src={it.author.avatarUrl}
            name={it.author.displayName}
            group={it.isGroup}
            state={it.allSeen ? 'seen' : 'unseen'}
            onClick={() => onOpen(it.author.id)}
          />
          <span className="w-full truncate text-center text-[12px]">{it.author.handle}</span>
        </li>
      ))}
    </ul>
  );
}
