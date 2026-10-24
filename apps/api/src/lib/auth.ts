import { account, session, user, verification } from '@lore/db';
import { uuidv7 } from '@lore/shared/ids';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getDb } from './db';
import { env, isProd } from './env';
import { unauthorized } from './errors';

/**
 * Better Auth: email/password + Facebook (plan section 8.6). Mounted at /api/auth/* by modules/auth.
 * Hooks registered by modules (e.g. personal account creation) are attached through `authHooks`.
 */
export const FACEBOOK_SCOPES = ['public_profile', 'email', 'user_likes', 'user_friends'];

type UserCreatedHook = (u: {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}) => Promise<void>;
export const authHooks: { onUserCreated: UserCreatedHook[] } = { onUserCreated: [] };

function build() {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(getDb(), { provider: 'pg', schema: { user, session, account, verification } }),
    emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8 },
    socialProviders:
      env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET
        ? {
            facebook: {
              clientId: env.FACEBOOK_CLIENT_ID,
              clientSecret: env.FACEBOOK_CLIENT_SECRET,
              scope: FACEBOOK_SCOPES,
              fields: ['id', 'name', 'email', 'picture.width(400)'],
            },
          }
        : {},
    account: { accountLinking: { enabled: true, trustedProviders: ['facebook'] } },
    session: { expiresIn: 60 * 60 * 24 * 30, cookieCache: { enabled: true, maxAge: 60 * 5 } },
    advanced: {
      database: { generateId: () => uuidv7() },
      useSecureCookies: isProd,
      crossSubDomainCookies:
        isProd && env.SESSION_COOKIE_DOMAIN !== 'localhost'
          ? { enabled: true, domain: env.SESSION_COOKIE_DOMAIN }
          : undefined,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (u) => {
            for (const hook of authHooks.onUserCreated) await hook(u);
          },
        },
      },
    },
  });
}

let instance: ReturnType<typeof build> | null = null;
export function getAuth() {
  if (!instance) instance = build();
  return instance;
}

export type SessionUser = { id: string; email: string; name: string; image: string | null; isGuest: boolean };

/** Resolve the session from raw node headers (used by REST hooks and the Socket.IO handshake). */
export async function sessionFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): Promise<SessionUser | null> {
  const res = await getAuth().api.getSession({ headers: fromNodeHeaders(headers) });
  if (!res?.user) return null;
  const u = res.user as typeof res.user & { guestExpiresAt?: Date | null };
  if (u.guestExpiresAt && new Date(u.guestExpiresAt) < new Date()) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image ?? null,
    isGuest: Boolean(u.guestExpiresAt),
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

/** preHandler: attaches `req.user` or throws 401. */
export async function requireUser(req: FastifyRequest, _reply: FastifyReply) {
  if (!req.user) req.user = await sessionFromHeaders(req.headers);
  if (!req.user) throw unauthorized();
}

/** preHandler: attaches `req.user` when signed in, never throws. */
export async function optionalUser(req: FastifyRequest, _reply: FastifyReply) {
  if (!req.user) req.user = await sessionFromHeaders(req.headers).catch(() => null);
}

export function me(req: FastifyRequest): SessionUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
