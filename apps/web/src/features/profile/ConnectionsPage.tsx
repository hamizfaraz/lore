'use client';
import type { ConnectionsDTO } from '@lore/shared/dto/graph';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/ListRow';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { FacebookButton } from '@/features/auth/FacebookButton';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { toast } from '@/lib/store';
import { FriendsOnLore } from './FriendsOnLore';

const SCOPE_LABELS: Record<string, string> = {
  public_profile: 'Name and profile picture',
  email: 'Email address',
  user_likes: 'Pages you like',
  user_friends: 'Friends who also use LORE',
};

/** Settings → Facebook: granted scopes, re-import, disconnect, Friends on LORE (section 8.6). */
export function ConnectionsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ran = useRef(false);

  const q = useQuery({
    queryKey: qk.connections,
    queryFn: () => api.get<ConnectionsDTO>('/v1/graph/connections'),
  });

  const reimport = async () => {
    setBusy(true);
    try {
      await api.post('/v1/graph/import', {});
      await qc.invalidateQueries({ queryKey: qk.connections });
      await qc.invalidateQueries({ queryKey: qk.me });
      toast('Facebook updated');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (ran.current) return;
    if (params.get('fb') === '1' || params.get('reimport') === '1') {
      ran.current = true;
      void reimport();
    }
  }, [params]);

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.post('/v1/graph/disconnect', {});
      await qc.invalidateQueries({ queryKey: qk.connections });
      await qc.invalidateQueries({ queryKey: qk.me });
      setConfirm(false);
      toast('Facebook disconnected');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const fb = q.data?.facebook;
  const friends = q.data?.friendsOnLore ?? [];
  const suggested = q.data?.suggestedTags ?? [];

  return (
    <StackScreen onBack={() => router.push('/settings')}>
      <TopBar title="Facebook" back onBack={() => router.push('/settings')} />
      <div className="mx-auto w-full max-w-[600px] pb-10">
        {q.isLoading && (
          <div className="space-y-3 px-4 pt-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {q.isError && (
          <p className="px-4 py-6 text-center text-ink-2" role="alert">
            Couldn't load your Facebook connection.{' '}
            <button type="button" className="font-semibold text-action" onClick={() => q.refetch()}>
              Try again
            </button>
          </p>
        )}
        {q.data && !fb && (
          <div className="space-y-4 px-4 pt-6 text-center">
            <p className="text-[15px]">
              Connect Facebook to suggest interests from pages you like and to see which friends are already
              on LORE. We never post to Facebook.
            </p>
            <FacebookButton
              label="Connect Facebook"
              variant="primary"
              callbackURL="/settings?section=facebook&fb=1"
            />
          </div>
        )}
        {fb && (
          <>
            <SectionHeader>Access you've granted</SectionHeader>
            <ul className="px-4 text-[15px]">
              {(fb.grantedScopes.length ? fb.grantedScopes : ['public_profile']).map((s) => (
                <li key={s} className="flex min-h-[44px] items-center justify-between border-b hairline py-2">
                  <span>{SCOPE_LABELS[s] ?? s}</span>
                  <span className="text-[13px] text-ink-2">On</span>
                </li>
              ))}
            </ul>
            {!fb.importedAt && (
              <p className="px-4 pt-3 text-[13px] text-ink-2">
                Facebook is connected. Import to refresh likes and friends.
              </p>
            )}
            <div className="flex flex-col gap-2 px-4 pt-4">
              <Button block size="lg" variant="secondary" loading={busy} onClick={reimport}>
                Re-import
              </Button>
              <Button block size="lg" variant="danger" disabled={busy} onClick={() => setConfirm(true)}>
                Disconnect Facebook
              </Button>
            </div>
            <SectionHeader>Friends on LORE</SectionHeader>
            <FriendsOnLore friends={friends} />
            {suggested.length > 0 && (
              <>
                <SectionHeader>Interests from Facebook</SectionHeader>
                <div className="flex flex-wrap gap-2 px-4">
                  {suggested.map((t) => (
                    <span key={t.tag} className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px]">
                      {t.tag} <span className="text-ink-2">from Facebook</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
      <Sheet open={confirm} onOpenChange={setConfirm} title="Disconnect Facebook?">
        <div className="space-y-4 px-6 pb-8 pt-2 text-[15px]">
          <p>
            We'll delete the pages and friends we imported, and the interests that came from Facebook. Your
            LORE account stays. We never post to Facebook.
          </p>
          <Button block size="lg" variant="danger" loading={busy} onClick={disconnect}>
            Disconnect
          </Button>
          <Button block variant="text" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </StackScreen>
  );
}
