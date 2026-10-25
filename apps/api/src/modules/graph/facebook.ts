import { env } from '../../lib/env';
import { badRequest } from '../../lib/errors';

export type FbLike = { id: string; name: string; category: string };

/** What LORE stores from one Graph pull (section 8.6). */
export type GraphProfile = {
  id: string;
  name: string;
  pictureUrl: string | null;
  grantedScopes: string[];
  likes: FbLike[];
  friendIds: string[];
};

/** Permission was not granted. Import continues with an empty list for that edge. */
export class GraphPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphPermissionError';
  }
}

type GraphErrorBody = { error?: { code?: number; message?: string } };

async function graphFetch(token: string, path: string, query: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`https://graph.facebook.com/${env.FB_GRAPH_VERSION}/${path.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    throw badRequest('Facebook could not be reached. Try again in a moment.');
  }
  const body = (await res.json().catch(() => ({}))) as GraphErrorBody & Record<string, unknown>;
  if (!res.ok) {
    const code = body.error?.code;
    const message = body.error?.message ?? 'Facebook request failed';
    if (code === 200 || code === 10 || /permission/i.test(message)) throw new GraphPermissionError(message);
    throw badRequest(message);
  }
  return body;
}

export function parseScope(scope: string | null | undefined): string[] {
  if (!scope) return [];
  return scope
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function optionalEdge<T>(fn: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GraphPermissionError) return empty;
    throw err;
  }
}

/**
 * GET /me, /me/permissions, /me/likes, /me/friends.
 * Declining user_likes or user_friends does not fail the import.
 */
export async function fetchGraphProfile(token: string, scopeFallback: string | null): Promise<GraphProfile> {
  const me = (await graphFetch(token, 'me', { fields: 'id,name,picture.width(400)' })) as {
    id?: string;
    name?: string;
    picture?: { data?: { url?: string } };
  };
  if (!me.id) throw badRequest('Facebook did not return a profile');

  const grantedScopes = await optionalEdge(async () => {
    const body = (await graphFetch(token, 'me/permissions')) as {
      data?: { permission?: string; status?: string }[];
    };
    const granted = (body.data ?? [])
      .filter((p) => p.status === 'granted' && p.permission)
      .map((p) => p.permission!);
    return granted.length ? granted : parseScope(scopeFallback);
  }, parseScope(scopeFallback));

  const likes = await optionalEdge(async () => {
    const body = (await graphFetch(token, 'me/likes', { fields: 'id,name,category', limit: '100' })) as {
      data?: { id?: string; name?: string; category?: string; category_list?: { name?: string }[] }[];
    };
    return (body.data ?? [])
      .filter((row) => row.id && row.name)
      .map((row) => ({
        id: row.id!,
        name: row.name!,
        category: row.category || row.category_list?.[0]?.name || '',
      }));
  }, [] as FbLike[]);

  const friendIds = await optionalEdge(async () => {
    const body = (await graphFetch(token, 'me/friends', { fields: 'id', limit: '100' })) as {
      data?: { id?: string }[];
    };
    return (body.data ?? []).map((row) => row.id).filter((id): id is string => Boolean(id));
  }, [] as string[]);

  return {
    id: me.id,
    name: me.name ?? '',
    pictureUrl: me.picture?.data?.url ?? null,
    grantedScopes,
    likes,
    friendIds,
  };
}
