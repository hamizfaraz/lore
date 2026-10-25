'use client';
import type { CreateTokenResult, TokenListDTO } from '@lore/shared/dto/mcp';
import type { TokenScope } from '@lore/shared/enums';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, PlugZap, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StackScreen } from '@/components/ui/StackScreen';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/lib/api';

const SCOPES: Array<{ value: TokenScope; label: string; detail: string }> = [
  { value: 'read', label: 'Read LORE', detail: 'Groups, plans, events, and podcast status' },
  { value: 'plans:write', label: 'Vote on plans', detail: 'Confirmed votes as you' },
  { value: 'drafts:write', label: 'Create proposals', detail: 'Private recaps and governed drafts' },
  { value: 'games:write', label: 'Create game lobbies', detail: 'Private group lobbies only' },
  { value: 'intros:write', label: 'Propose introductions', detail: 'Consent-gated Common Ground intros' },
];

/** Connect Muse [C2] — placeholder created by the C1-0b scaffold; the owner replaces this file's contents. */
export function ConnectMusePage() {
  const client = useQueryClient();
  const [name, setName] = useState('Muse on my device');
  const [scopes, setScopes] = useState<TokenScope[]>(['read']);
  const [revealed, setRevealed] = useState<CreateTokenResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [endpoint, setEndpoint] = useState('https://mcp.ourlore.tech/mcp');
  useEffect(() => {
    if (
      window.location.hostname === 'localhost' ||
      /^10\.|^192\.168\.|^172\./.test(window.location.hostname)
    ) {
      setEndpoint(`${window.location.protocol}//${window.location.hostname}:4100/mcp`);
    }
  }, []);

  const tokens = useQuery({
    queryKey: ['mcp-tokens'],
    queryFn: () => api.get<TokenListDTO>('/v1/mcp/tokens'),
  });
  const create = useMutation({
    mutationFn: () => api.post<CreateTokenResult>('/v1/mcp/tokens', { name, scopes }),
    onSuccess: (result) => {
      setRevealed(result);
      client.invalidateQueries({ queryKey: ['mcp-tokens'] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/v1/mcp/tokens/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['mcp-tokens'] }),
  });

  const toggleScope = (scope: TokenScope) => {
    if (scope === 'read') return;
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <StackScreen>
      <TopBar title="Connect Muse" back={true} />
      <main className="mx-auto w-full max-w-[640px] flex-1 space-y-5 px-4 pb-24 pt-4">
        <section className="rounded-2xl bg-surface-2 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-ai/10 p-2 text-ai">
              <PlugZap size={22} />
            </div>
            <div>
              <h1 className="font-display text-[22px] font-semibold">Use LORE from Muse</h1>
              <p className="mt-1 text-[13px] text-ink-2">
                Create a scoped key, then add this secure MCP connection in Muse. Every write still asks for
                confirmation.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border bg-bg p-3 hairline">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Server address</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate text-[12px]">{endpoint}</code>
              <button
                type="button"
                aria-label="Copy server address"
                onClick={() => copy(endpoint)}
                className="text-action"
              >
                <Copy size={17} />
              </button>
            </div>
          </div>
        </section>

        {revealed && (
          <section className="rounded-2xl border border-ai/30 bg-ai/5 p-4">
            <div className="flex items-center gap-2 font-semibold text-ai">
              <KeyRound size={18} /> Copy your key now
            </div>
            <p className="mt-1 text-[12px] text-ink-2">
              For your safety, LORE will never show this key again.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-bg p-3 hairline">
              <code className="min-w-0 flex-1 break-all text-[12px]">{revealed.token}</code>
              <button
                type="button"
                aria-label="Copy access key"
                onClick={() => copy(revealed.token)}
                className="text-action"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <Button className="mt-3" variant="secondary" onClick={() => setRevealed(null)}>
              I saved it
            </Button>
          </section>
        )}

        <section className="rounded-2xl bg-surface-2 p-4">
          <h2 className="font-display text-[18px] font-semibold">New connection key</h2>
          <label className="mt-3 block">
            <span className="mb-1 block text-[12px] font-semibold">Name</span>
            <input
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border bg-bg px-3 py-2 hairline outline-none focus:border-action"
            />
          </label>
          <div className="mt-4 space-y-2">
            {SCOPES.map((scope) => (
              <label key={scope.value} className="flex cursor-pointer items-start gap-3 rounded-xl bg-bg p-3">
                <input
                  type="checkbox"
                  checked={scopes.includes(scope.value)}
                  disabled={scope.value === 'read'}
                  onChange={() => toggleScope(scope.value)}
                  className="mt-1 accent-action"
                />
                <span>
                  <span className="block text-[14px] font-semibold">{scope.label}</span>
                  <span className="block text-[12px] text-ink-2">{scope.detail}</span>
                </span>
              </label>
            ))}
          </div>
          <Button
            block
            className="mt-4"
            loading={create.isPending}
            disabled={!name.trim()}
            onClick={() => create.mutate()}
          >
            Create key
          </Button>
          {create.error && <p className="mt-2 text-[12px] text-heart">{create.error.message}</p>}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={18} />
            <h2 className="font-display text-[18px] font-semibold">Connected keys</h2>
          </div>
          {tokens.isLoading && <p className="py-5 text-center text-ink-2">Loading keys…</p>}
          <div className="space-y-2">
            {tokens.data?.tokens.map((token) => (
              <article key={token.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
                <KeyRound size={19} className="text-ink-2" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{token.name}</p>
                  <p className="truncate text-[11px] text-ink-3">{token.scopes.join(' · ')}</p>
                  {token.revokedAt && <p className="text-[11px] text-heart">Revoked</p>}
                </div>
                {!token.revokedAt && (
                  <button
                    type="button"
                    aria-label={`Revoke ${token.name}`}
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(token.id)}
                    className="text-heart"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </article>
            ))}
          </div>
          {tokens.data?.tokens.length === 0 && (
            <p className="rounded-2xl bg-surface-2 p-5 text-center text-[13px] text-ink-2">
              No connection keys yet.
            </p>
          )}
        </section>
      </main>
    </StackScreen>
  );
}
