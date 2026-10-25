'use client';
import type { ConversationDTO } from '@lore/shared/dto/chat';
import type { PolicyDTO } from '@lore/shared/dto/groups';
import type { PolicyMode } from '@lore/shared/enums';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { SectionHeader } from '@/components/ui/ListRow';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import { uploadFile } from '@/lib/upload';

const MODES: { mode: PolicyMode; title: string; body: string }[] = [
  { mode: 'direct', title: 'Direct', body: 'Eligible members publish immediately.' },
  { mode: 'threshold', title: 'Approvals', body: 'A post needs N approvals before it goes live.' },
  { mode: 'unanimous', title: 'Unanimous', body: 'Every eligible member must approve.' },
  { mode: 'courtesy', title: 'Courtesy', body: 'Direct, but authors can send posts for review.' },
];

function PolicyEditor({
  value,
  onChange,
  members,
}: {
  value: { mode: PolicyMode; threshold: number };
  onChange: (v: { mode: PolicyMode; threshold: number }) => void;
  members: number;
}) {
  return (
    <div className="space-y-2 px-4">
      {MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          onClick={() => onChange({ ...value, mode: m.mode })}
          className={cn(
            'press flex w-full items-start gap-3 rounded-xl border p-3 text-left',
            value.mode === m.mode ? 'border-ink' : 'border-line',
          )}
        >
          <span
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0 rounded-full border-2',
              value.mode === m.mode ? 'border-[6px] border-ink' : 'border-line',
            )}
          />
          <span className="flex-1">
            <span className="block font-semibold">{m.title}</span>
            <span className="block text-[13px] text-ink-2">{m.body}</span>
            {m.mode === 'threshold' && value.mode === 'threshold' && (
              <span className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  className="h-8 w-8 rounded-full bg-surface-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({ ...value, threshold: Math.max(1, value.threshold - 1) });
                  }}
                >
                  −
                </button>
                <span className="text-[15px] font-semibold">
                  {value.threshold} of {members}
                </span>
                <button
                  type="button"
                  className="h-8 w-8 rounded-full bg-surface-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({ ...value, threshold: Math.min(members, value.threshold + 1) });
                  }}
                >
                  +
                </button>
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Group account creation + publishing policy editor [C1] (section 8.4 steps 1–2). */
export function GroupAccountSection({ conv }: { conv: ConversationDTO }) {
  const qc = useQueryClient();
  const isAdmin = conv.myRole === 'primary_admin' || conv.myRole === 'admin';
  const acct = conv.groupAccount;
  const policy = useQuery({
    queryKey: qk.policy(acct?.id ?? ''),
    queryFn: () => api.get<PolicyDTO>(`/v1/accounts/${acct!.id}/policy`),
    enabled: Boolean(acct),
  });
  const [handle, setHandle] = useState(
    conv.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24),
  );
  const [name, setName] = useState(conv.title);
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<{ id: string | null; url: string | null }>({ id: null, url: null });
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [pol, setPol] = useState<{ mode: PolicyMode; threshold: number }>({
    mode: 'threshold',
    threshold: Math.min(3, conv.members.length),
  });
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (policy.data)
      setPol({
        mode: policy.data.mode,
        threshold: policy.data.threshold ?? Math.min(3, conv.members.length),
      });
  }, [policy.data, conv.members.length]);

  const create = async () => {
    setBusy(true);
    try {
      await api.post(`/v1/conversations/${conv.id}/group-account`, {
        handle,
        displayName: name,
        bio: bio || undefined,
        avatarMediaId: avatar.id,
        visibility,
        policy: { mode: pol.mode, threshold: pol.mode === 'threshold' ? pol.threshold : null },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.conversation(conv.id) }),
        qc.invalidateQueries({ queryKey: qk.me }),
      ]);
      toast(`@${handle} created`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const savePolicy = async () => {
    setBusy(true);
    try {
      await api.put(`/v1/accounts/${acct!.id}/policy`, {
        mode: pol.mode,
        threshold: pol.mode === 'threshold' ? pol.threshold : null,
      });
      await policy.refetch();
      toast('Publishing policy updated');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (acct) {
    const changed =
      policy.data &&
      (policy.data.mode !== pol.mode ||
        (pol.mode === 'threshold' && policy.data.threshold !== pol.threshold));
    return (
      <>
        <SectionHeader>Group account</SectionHeader>
        <Link href={`/g/${acct.handle}`} className="press flex items-center gap-3 px-4 py-2">
          <Avatar src={acct.avatarUrl} name={acct.displayName} size={44} />
          <span>
            <span className="block font-semibold">@{acct.handle}</span>
            <span className="block text-[13px] text-ink-2">{acct.displayName}</span>
          </span>
        </Link>
        <SectionHeader>Publishing policy</SectionHeader>
        {isAdmin ? (
          <>
            <PolicyEditor value={pol} onChange={setPol} members={conv.members.length} />
            {changed && (
              <div className="px-4 pt-3">
                <Button block loading={busy} onClick={savePolicy}>
                  Save policy
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="px-4 text-[14px]">
            {policy.data
              ? `${MODES.find((m) => m.mode === policy.data!.mode)?.title}${policy.data.mode === 'threshold' ? ` · ${policy.data.threshold} approvals` : ''}`
              : '…'}
          </p>
        )}
      </>
    );
  }
  if (!isAdmin) {
    return (
      <>
        <SectionHeader>Group account</SectionHeader>
        <p className="px-4 text-[13px] text-ink-2">
          An admin can create a shared group account for this chat.
        </p>
      </>
    );
  }
  return (
    <>
      <SectionHeader>Create group account</SectionHeader>
      <p className="px-4 pb-3 text-[13px] text-ink-2">
        A profile the whole group posts to. No second login: members post as @{handle || 'group'} from Create.
      </p>
      <div className="flex flex-col items-center gap-2 pb-3">
        <button type="button" onClick={() => file.current?.click()} className="press relative">
          <Avatar src={avatar.url} name={name} size={80} />
          <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg bg-action text-white">
            <Camera size={14} />
          </span>
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const m = await uploadFile(f, 'image').catch((err) => {
              toast(err.message, 'error');
              return null;
            });
            if (m) setAvatar({ id: m.id, url: m.thumbUrl ?? m.url });
          }}
        />
      </div>
      <div className="space-y-2 px-4">
        <Field
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
          placeholder="Username"
          maxLength={30}
        />
        <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={60} />
        <Field value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" maxLength={150} />
        <div className="flex gap-2">
          {(['public', 'private'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={cn(
                'flex-1 rounded-lg border py-2 text-[14px] font-semibold capitalize',
                visibility === v ? 'border-ink' : 'border-line text-ink-2',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <SectionHeader>Publishing policy</SectionHeader>
      <PolicyEditor value={pol} onChange={setPol} members={conv.members.length} />
      <div className="px-4 pt-4">
        <Button block size="lg" loading={busy} disabled={handle.length < 2 || !name} onClick={create}>
          Create @{handle || 'group'}
        </Button>
      </div>
    </>
  );
}
