'use client';
import type { DraftCardDTO } from '@lore/shared/dto/groups';
import { useQuery } from '@tanstack/react-query';
import { Check, MessageSquare, PencilLine, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { BlurImage } from '@/components/ui/BlurImage';
import { Button } from '@/components/ui/Button';
import { CardShell } from '@/components/ui/CardShell';
import { ConfirmHold } from '@/components/ui/ConfirmHold';
import { AiPill, Chip, ConfirmedPill } from '@/components/ui/Labels';
import { Sheet } from '@/components/ui/Sheet';
import type { CardProps } from '@/features/chat/cards/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { tap } from '@/lib/haptics';
import { qk } from '@/lib/query-keys';
import { onEvent } from '@/lib/socket';
import { toast } from '@/lib/store';

const MODE_TEXT = {
  direct: 'Members publish directly',
  courtesy: 'Courtesy review',
  threshold: 'approvals',
  unanimous: 'Everyone approves',
} as const;

/**
 * `draft_card` [C1]: preview, "2 of 3 approvals", voter avatars with check/empty states,
 * Approve / Request changes / Discuss, live updates; editing voids approvals (section 8.4 step 3).
 */
export default function DraftCard({ message, data, meUserId }: CardProps<'draft_card'>) {
  const id = message.cardRefId!;
  const q = useQuery({
    queryKey: qk.draft(id),
    queryFn: () => api.get<DraftCardDTO>(`/v1/drafts/${id}`),
    initialData: data,
    staleTime: 5_000,
  });
  const [d, setD] = useState<DraftCardDTO | undefined>(data);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setD(q.data ?? data), [q.data, data]);
  useEffect(() => onEvent('draft.updated', (e) => e.data.id === id && setD(e.data)), [id]);
  if (!d) return <div className="h-48 w-[300px] animate-pulse rounded-2xl bg-surface-2" />;

  const approved = d.approvals.filter((a) => a.decision === 'approve');
  const mine = d.approvals.find((a) => a.userId === meUserId);
  const canVote =
    d.voters.some((v) => v.userId === meUserId) &&
    (d.state === 'submitted' || d.state === 'changes_requested');
  const isAuthor = d.createdBy?.userId === meUserId;
  const directMode = d.policy?.mode === 'direct' || d.policy?.mode === 'courtesy';
  const run = async (fn: () => Promise<DraftCardDTO>) => {
    setBusy(true);
    try {
      setD(await fn());
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const vote = (decision: 'approve' | 'request_changes') => {
    tap();
    return run(() => api.post<DraftCardDTO>(`/v1/drafts/${id}/approvals`, { decision }));
  };

  const labels = (
    <>
      {d.createdByAi && <AiPill label="AI draft" />}
      {d.state === 'published' ? (
        <ConfirmedPill
          text={`Approved by ${approved.length || 1} member${approved.length === 1 ? '' : 's'}`}
        />
      ) : d.state === 'changes_requested' ? (
        <Chip tone="warn">Changes requested</Chip>
      ) : d.state === 'cancelled' ? (
        <Chip>Cancelled</Chip>
      ) : d.policy && !directMode ? (
        <Chip>
          {approved.length} of {d.needed} {d.policy.mode === 'threshold' ? MODE_TEXT.threshold : 'approvals'}
        </Chip>
      ) : (
        <Chip>{d.policy ? MODE_TEXT[d.policy.mode] : 'Draft'}</Chip>
      )}
      {d.version > 1 && <Chip>v{d.version}</Chip>}
    </>
  );

  return (
    <CardShell
      icon={<ShieldCheck size={20} />}
      title={`Post to @${d.account.handle}`}
      labels={labels}
      ai={d.createdByAi}
    >
      <div className="mt-1 grid grid-cols-3 gap-0.5 overflow-hidden rounded-lg">
        {d.media.slice(0, 3).map((m, i) => (
          <div
            key={m.id}
            className={cn(
              'relative aspect-square',
              d.media.length === 1 && 'col-span-3 aspect-[4/3]',
              i === 0 && d.media.length === 2 && 'col-span-2',
            )}
          >
            <BlurImage src={m.thumbUrl ?? m.url} blurhash={m.blurhash} />
            {m.aiGenerated && <AiPill className="absolute bottom-1 left-1" />}
          </div>
        ))}
      </div>
      {d.caption && <p className="mt-2 line-clamp-3 text-[14px]">{d.caption}</p>}
      <div className="mt-2.5 flex items-center gap-1.5">
        {d.voters.map((v) => {
          const a = d.approvals.find((x) => x.userId === v.userId);
          return (
            <span
              key={v.userId}
              className="relative"
              title={`${v.displayName}${a ? (a.decision === 'approve' ? ' approved' : ' requested changes') : ''}`}
            >
              <span className={cn('block rounded-full', !a && 'opacity-35')}>
                <Avatar src={v.avatarUrl} name={v.displayName} size={26} />
              </span>
              {a?.decision === 'approve' && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-verified text-white ring-2 ring-bg">
                  <Check size={9} strokeWidth={3.5} />
                </span>
              )}
              {a?.decision === 'request_changes' && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-ring-b ring-2 ring-bg" />
              )}
            </span>
          );
        })}
      </div>
      {d.approvals.some((a) => a.note) && (
        <div className="mt-2 space-y-1">
          {d.approvals
            .filter((a) => a.note)
            .map((a) => (
              <p key={a.userId} className="text-[12px] text-ink-2">
                <b>{a.displayName.split(' ')[0]}:</b> {a.note}
              </p>
            ))}
        </div>
      )}

      {d.state === 'published' && d.publishedPostId && (
        <Link href={`/p/${d.publishedPostId}`} className="mt-3 block text-[14px] font-semibold text-action">
          View post on @{d.account.handle}
        </Link>
      )}
      {(d.state === 'submitted' || d.state === 'changes_requested' || d.state === 'editing') && (
        <div className="mt-3 space-y-2">
          {canVote && !directMode && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                loading={busy}
                variant={mine?.decision === 'approve' ? 'secondary' : 'primary'}
                disabled={mine?.decision === 'approve'}
                onClick={() => vote('approve')}
              >
                {mine?.decision === 'approve' ? 'Approved' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                disabled={busy}
                onClick={() => vote('request_changes')}
              >
                Request changes
              </Button>
            </div>
          )}
          {directMode &&
            (isAuthor || canVote) &&
            (d.createdByAi ? (
              <Button size="sm" block loading={busy} onClick={() => vote('approve')}>
                Approve & publish
              </Button>
            ) : (
              <ConfirmHold
                className="w-full"
                onConfirm={() => run(() => api.post<DraftCardDTO>(`/v1/drafts/${id}/publish`))}
              >
                Hold to publish
              </ConfirmHold>
            ))}
          <div className="flex gap-4 text-[13px] font-semibold text-ink-2">
            <button
              type="button"
              className="press flex items-center gap-1"
              onClick={() => window.dispatchEvent(new CustomEvent('lore:reply', { detail: message.id }))}
            >
              <MessageSquare size={14} /> Discuss
            </button>
            {(isAuthor || canVote) && (
              <button
                type="button"
                className="press flex items-center gap-1"
                onClick={() => {
                  setCaption(d.caption);
                  setEditing(true);
                }}
              >
                <PencilLine size={14} /> Edit caption
              </button>
            )}
          </div>
        </div>
      )}
      <Sheet open={editing} onOpenChange={setEditing} title="Edit caption">
        <div className="space-y-3 p-4">
          <p className="text-[13px] text-ink-2">
            Editing creates version {d.version + 1}; existing approvals are cleared.
          </p>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={5}
            maxLength={2200}
            className="w-full rounded-lg bg-surface-2 p-3 text-[16px] outline-none"
          />
          <Button
            block
            size="lg"
            loading={busy}
            onClick={async () => {
              await run(() => api.patch<DraftCardDTO>(`/v1/drafts/${id}`, { caption }));
              setEditing(false);
            }}
          >
            Save
          </Button>
        </div>
      </Sheet>
    </CardShell>
  );
}
