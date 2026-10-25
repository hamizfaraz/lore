'use client';
import type { ConversationDTO } from '@lore/shared/dto/chat';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SearchField } from '@/components/ui/SearchField';
import { Sheet } from '@/components/ui/Sheet';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';

type Person = { userId: string; handle: string; displayName: string; avatarUrl: string | null };

/** "New message": search people, pick one (DM) or several (group chat with a name). */
export function NewMessageSheet({
  open,
  onOpenChange,
  mode = 'new',
  conversationId,
}: { open: boolean; onOpenChange: (v: boolean) => void; mode?: 'new' | 'add'; conversationId?: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Person[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const results = useQuery({
    queryKey: qk.userSearch(q),
    queryFn: () => api.get<{ items: Person[] }>(`/v1/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });
  const toggle = (p: Person) =>
    setSel((s) =>
      s.some((x) => x.userId === p.userId) ? s.filter((x) => x.userId !== p.userId) : [...s, p],
    );
  const go = async () => {
    setBusy(true);
    try {
      if (mode === 'add' && conversationId) {
        await api.post(`/v1/conversations/${conversationId}/members`, { userIds: sel.map((s) => s.userId) });
        onOpenChange(false);
      } else {
        const c = await api.post<ConversationDTO>('/v1/conversations', {
          kind: sel.length > 1 ? 'group' : 'dm',
          memberUserIds: sel.map((s) => s.userId),
          title: title || undefined,
        });
        onOpenChange(false);
        router.push(`/c/${c.id}`);
      }
      setSel([]);
      setTitle('');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      snap="full"
      title={mode === 'add' ? 'Add people' : 'New message'}
    >
      <div className="space-y-2 px-4 pt-2">
        <SearchField
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onClear={() => setQ('')}
          placeholder="Search"
        />
        {sel.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sel.map((s) => (
              <button
                key={s.userId}
                type="button"
                onClick={() => toggle(s)}
                className="rounded-full bg-action/15 px-2.5 py-1 text-[13px] font-semibold text-action"
              >
                {s.displayName} ×
              </button>
            ))}
          </div>
        )}
        {mode === 'new' && sel.length > 1 && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Group name (optional)"
            className="h-10 w-full border-b hairline bg-transparent text-[16px] outline-none"
          />
        )}
      </div>
      <div className="py-2">
        {(results.data?.items ?? []).map((p) => {
          const on = sel.some((x) => x.userId === p.userId);
          return (
            <button
              key={p.userId}
              type="button"
              onClick={() => toggle(p)}
              className="press flex w-full items-center gap-3 px-4 py-2 text-left"
            >
              <Avatar src={p.avatarUrl} name={p.displayName} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{p.displayName}</span>
                <span className="block truncate text-[13px] text-ink-2">{p.handle}</span>
              </span>
              <span
                className={
                  on
                    ? 'flex h-6 w-6 items-center justify-center rounded-full bg-action text-white'
                    : 'h-6 w-6 rounded-full border-2 border-line'
                }
              >
                {on && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="sticky bottom-0 bg-elevated p-4 pb-safe">
        <Button block size="lg" disabled={!sel.length} loading={busy} onClick={go}>
          {mode === 'add' ? 'Add' : sel.length > 1 ? 'Create group chat' : 'Chat'}
        </Button>
      </div>
    </Sheet>
  );
}
