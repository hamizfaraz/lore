'use client';
import type { CommentDTO } from '@lore/shared/dto/social';
import { useState } from 'react';
import { ago } from '@/lib/time';
import { Avatar } from './Avatar';
import { Sheet } from './Sheet';

const QUICK = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

/** Bottom sheet, 90% height, emoji quick row, input pinned above the keyboard (section 9.2). */
export function CommentsSheet({
  open,
  onOpenChange,
  comments,
  loading,
  onSubmit,
  me,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  comments: CommentDTO[];
  loading?: boolean;
  onSubmit: (body: string) => Promise<void> | void;
  me?: { avatarUrl: string | null; displayName: string } | null;
}) {
  const [body, setBody] = useState('');
  const submit = async () => {
    const b = body.trim();
    if (!b) return;
    setBody('');
    await onSubmit(b);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Comments"
      snap="full"
      footer={
        <div className="border-t hairline">
          <div className="flex justify-around px-3 py-2 text-[24px]">
            {QUICK.map((e) => (
              <button key={e} type="button" className="press" onClick={() => setBody((b) => b + e)}>
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-3 pb-2">
            <Avatar src={me?.avatarUrl} name={me?.displayName} size={36} />
            <div className="flex flex-1 items-center rounded-full border hairline px-4">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Add a comment…"
                className="h-10 flex-1 bg-transparent text-[16px] outline-none"
              />
              {body.trim() && (
                <button type="button" onClick={submit} className="font-semibold text-action">
                  Post
                </button>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4 px-4 py-3">
        {loading && <p className="py-8 text-center text-ink-2">Loading…</p>}
        {!loading && comments.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[20px] font-bold">No comments yet</p>
            <p className="text-ink-2">Start the conversation.</p>
          </div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar src={c.author.avatarUrl} name={c.author.displayName} size={32} />
            <div className="text-[14px]">
              <p>
                <b className="font-semibold">{c.author.handle}</b>{' '}
                <span className="text-[12px] text-ink-2">{ago(c.createdAt)}</span>
              </p>
              <p className="whitespace-pre-line break-words">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
