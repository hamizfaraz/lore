import { Redis } from 'ioredis';
import { env } from './env';

let shared: Redis | null = null;

/** Shared Valkey connection for caches, idempotency keys, game state, rate budgets. */
export function getRedis(): Redis {
  if (!shared) shared = createRedis();
  return shared;
}

/** New connection (BullMQ and the Socket.IO adapter need their own; maxRetriesPerRequest null for BullMQ). */
export function createRedis(opts: { bullmq?: boolean } = {}): Redis {
  return new Redis(env.VALKEY_URL, {
    maxRetriesPerRequest: opts.bullmq ? null : 3,
    lazyConnect: false,
    enableOfflineQueue: true,
  });
}

export async function closeRedis() {
  await shared?.quit().catch(() => {});
  shared = null;
}
