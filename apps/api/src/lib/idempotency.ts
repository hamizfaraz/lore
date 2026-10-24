import type { FastifyRequest } from 'fastify';
import { getRedis } from './redis';

/**
 * Mutations accept `Idempotency-Key`; duplicate keys return the first result (section 4).
 * Results are cached in Valkey for 24 h, scoped per user. Falls through when Valkey is down.
 */
export async function idempotent<T>(req: FastifyRequest, scope: string, fn: () => Promise<T>): Promise<T> {
  const key = req.headers['idempotency-key'];
  if (!key || typeof key !== 'string') return fn();
  const k = `idem:${req.user?.id ?? 'anon'}:${scope}:${key}`;
  const redis = getRedis();
  try {
    const hit = await redis.get(k);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    return fn();
  }
  const result = await fn();
  await redis.set(k, JSON.stringify(result), 'EX', 60 * 60 * 24).catch(() => {});
  return result;
}
