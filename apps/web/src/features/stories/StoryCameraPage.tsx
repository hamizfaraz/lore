'use client';
import type { MeDTO } from '@lore/shared/dto/users';
import { useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, RefreshCw, X, Zap, ZapOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import { uploadFile } from '@/lib/upload';

/** In-app story camera [C1]: getUserMedia shutter, flip, flash; gallery picker; share to your story (section 9.3). */
export function StoryCameraPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [flash, setFlash] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        stream.current?.getTracks().forEach((t) => t.stop());
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
        setError(null);
      } catch {
        setError('Camera unavailable. Choose a photo from your library instead.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facing]);
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    if (facing === 'user') {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    if (flash) ctx.filter = 'brightness(1.25)';
    ctx.drawImage(v, 0, 0);
    c.toBlob((b) => b && setShot({ blob: b, url: URL.createObjectURL(b) }), 'image/jpeg', 0.9);
  };

  const share = async () => {
    if (!shot) return;
    const acct = (qc.getQueryData<MeDTO>(qk.me) ?? me.data)?.personalAccount;
    if (!acct) return;
    setBusy(true);
    try {
      const m = await uploadFile(new File([shot.blob], 'story.jpg', { type: 'image/jpeg' }), 'image');
      await api.post('/v1/stories', { authorAccountId: acct.id, mediaId: m.id });
      qc.invalidateQueries({ queryKey: qk.storiesRail });
      toast('Added to your story');
      router.back();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chrome fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden rounded-b-2xl">
        {shot ? (
          <img src={shot.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
          />
        )}
        {error && !shot && <p className="absolute inset-x-8 top-1/2 text-center text-[15px]">{error}</p>}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(var(--safe-top)+10px)]">
          <button
            type="button"
            aria-label="Close"
            onClick={() => (shot ? setShot(null) : router.back())}
            className="press"
          >
            <X size={30} />
          </button>
          {!shot && (
            <button type="button" aria-label="Flash" onClick={() => setFlash((f) => !f)} className="press">
              {flash ? <Zap size={26} /> : <ZapOff size={26} />}
            </button>
          )}
        </div>
      </div>
      <div className="flex h-36 items-center justify-around px-6 pb-safe">
        {shot ? (
          <>
            <Button variant="secondary" onClick={() => setShot(null)}>
              Retake
            </Button>
            <Button onClick={share} loading={busy} className="gap-2">
              <Avatar
                src={me.data?.personalAccount?.avatarUrl}
                name={me.data?.personalAccount?.displayName}
                size={22}
              />
              Your story
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label="Gallery"
              onClick={() => file.current?.click()}
              className="press"
            >
              <ImageIcon size={30} />
            </button>
            <button
              type="button"
              aria-label="Take photo"
              onClick={capture}
              className="press-btn h-[76px] w-[76px] rounded-full border-[5px] border-white bg-white/20"
            />
            <button
              type="button"
              aria-label="Flip camera"
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              className="press"
            >
              <RefreshCw size={28} />
            </button>
          </>
        )}
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setShot({ blob: f, url: URL.createObjectURL(f) });
        }}
      />
    </div>
  );
}
