'use client';
import type { ProfileDTO } from '@lore/shared/dto/users';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import { uploadFile } from '@/lib/upload';

export function EditProfileSheet({
  open,
  onOpenChange,
  profile,
}: { open: boolean; onOpenChange: (v: boolean) => void; profile: ProfileDTO }) {
  const qc = useQueryClient();
  const [name, setName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatar, setAvatar] = useState<{ id: string | null; url: string | null }>({
    id: null,
    url: profile.avatarUrl,
  });
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/v1/me/profile', {
        displayName: name,
        handle,
        bio,
        ...(avatar.id ? { avatarMediaId: avatar.id } : {}),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.me }),
        qc.invalidateQueries({ queryKey: ['account'] }),
      ]);
      onOpenChange(false);
      if (handle !== profile.handle) window.location.assign(`/u/${handle}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const row = (label: string, el: React.ReactNode) => (
    <label className="flex items-start gap-4 border-b hairline px-5 py-3">
      <span className="w-24 shrink-0 pt-1 text-[15px]">{label}</span>
      {el}
    </label>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} snap="full" title="Edit profile">
      <div className="flex flex-col items-center gap-2 py-5">
        <Avatar src={avatar.url} name={name} size={86} />
        <button type="button" className="font-semibold text-action" onClick={() => file.current?.click()}>
          Edit picture
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const m = await uploadFile(f, 'image');
              setAvatar({ id: m.id, url: m.thumbUrl ?? m.url });
            } catch (err) {
              toast((err as Error).message, 'error');
            }
          }}
        />
      </div>
      {row(
        'Name',
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-transparent text-[16px] outline-none"
        />,
      )}
      {row(
        'Username',
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
          className="flex-1 bg-transparent text-[16px] outline-none"
        />,
      )}
      {row(
        'Bio',
        <textarea
          value={bio}
          maxLength={150}
          rows={3}
          onChange={(e) => setBio(e.target.value)}
          className="flex-1 resize-none bg-transparent text-[16px] outline-none"
        />,
      )}
      <div className="p-5">
        <Button block size="lg" loading={busy} onClick={save}>
          Done
        </Button>
      </div>
    </Sheet>
  );
}
