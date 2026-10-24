'use client';
import type { ConversationRowDTO } from '@lore/shared/dto/chat';
import { Check, Link2, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { AvatarStack } from './Avatar';
import { Button } from './Button';
import { SearchField } from './SearchField';
import { Sheet } from './Sheet';

/** Search, grid of recent chats/people (groups included), "Add to story", "Copy link" (section 9.2). */
export function ShareSheet({
  open,
  onOpenChange,
  chats,
  onSend,
  onAddToStory,
  link,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chats: ConversationRowDTO[];
  onSend: (conversationIds: string[]) => Promise<void> | void;
  onAddToStory?: () => void;
  link?: string;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const list = chats.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setSel([]);
      }}
      snap="half"
    >
      <div className="px-3 pt-2">
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} />
      </div>
      <div className="grid grid-cols-3 gap-y-4 px-2 py-4">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className="press flex flex-col items-center gap-1.5"
          >
            <span className="relative">
              <AvatarStack srcs={c.avatars} size={64} />
              {sel.includes(c.id) && (
                <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg bg-action text-white">
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
            </span>
            <span
              className={cn('w-24 truncate text-center text-[12px]', sel.includes(c.id) && 'font-semibold')}
            >
              {c.title}
            </span>
          </button>
        ))}
      </div>
      <div className="sticky bottom-0 border-t hairline bg-elevated px-4 py-3 pb-safe">
        {sel.length > 0 ? (
          <Button
            block
            size="lg"
            onClick={async () => {
              await onSend(sel);
              setSel([]);
              onOpenChange(false);
            }}
          >
            Send{sel.length > 1 ? ' separately' : ''}
          </Button>
        ) : (
          <div className="flex justify-around">
            {onAddToStory && (
              <button
                type="button"
                onClick={onAddToStory}
                className="press flex flex-col items-center gap-1 text-[12px]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
                  <PlusCircle size={22} />
                </span>
                Add to story
              </button>
            )}
            {link && (
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(link)}
                className="press flex flex-col items-center gap-1 text-[12px]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
                  <Link2 size={22} />
                </span>
                Copy link
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
