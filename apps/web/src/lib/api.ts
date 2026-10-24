import { uuidv7 } from '@lore/shared/ids';

/** Typed REST client. Same-origin `/v1/*` (Next rewrites in dev, Caddy in prod); cookies carry the session. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type Opts = { body?: unknown; idempotent?: boolean; signal?: AbortSignal; headers?: Record<string, string> };

async function request<T>(method: string, path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.idempotent ?? method !== 'GET') headers['idempotency-key'] = uuidv7();
  const res = await fetch(path.startsWith('/') ? path : `/v1/${path}`, {
    method,
    headers,
    credentials: 'include',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string } }).error;
    throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? res.statusText);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Opts) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: Opts) =>
    request<T>('POST', path, { ...opts, body: body ?? {} }),
  put: <T>(path: string, body?: unknown, opts?: Opts) =>
    request<T>('PUT', path, { ...opts, body: body ?? {} }),
  patch: <T>(path: string, body?: unknown, opts?: Opts) =>
    request<T>('PATCH', path, { ...opts, body: body ?? {} }),
  del: <T>(path: string, opts?: Opts) => request<T>('DELETE', path, opts),
};

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};
