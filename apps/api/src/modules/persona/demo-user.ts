import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { optionalUser } from '../../lib/auth';
import { env } from '../../lib/env';
import { unauthorized } from '../../lib/errors';

const demoHeader = z.string().uuid();

/** Local seeded-demo identity; disabled unconditionally in production. Real sessions always win. */
export async function optionalC2DemoUser(request: FastifyRequest, reply: Parameters<typeof optionalUser>[1]) {
  await optionalUser(request, reply);
  if (request.user || env.NODE_ENV === 'production' || env.DEMO_FAST_PROACTIVE !== '1') return;
  const parsed = demoHeader.safeParse(request.headers['x-lore-demo-user']);
  if (!parsed.success) return;
  request.user = {
    id: parsed.data,
    email: 'demo@ourlore.test',
    name: 'Demo member',
    image: null,
    isGuest: false,
  };
}

export function c2UserId(request: FastifyRequest): string {
  if (!request.user) throw unauthorized();
  return request.user.id;
}
