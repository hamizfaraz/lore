import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from './lib/db';
import { env } from './lib/env';
import { registerErrorHandler } from './lib/errors';
import { loggerOptions } from './lib/logger';
import { getRedis } from './lib/redis';
import { s3Configured } from './lib/s3';
import { modules } from './modules/index';
import { sql } from '@lore/db';

/** Builds the Fastify app with every module's routes. Shared by server.ts and tests. */
export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === false ? false : (loggerOptions as any),
    genReqId: () => uuidv7(),
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorateRequest('user', null);
  registerErrorHandler(app);

  await app.register(cors, { origin: [env.APP_URL], credentials: true });
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute', allowList: ['127.0.0.1'] });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  app.get('/health', async () => ({ ok: true, service: 'api', at: new Date().toISOString() }));

  /** Deep readiness: database, Valkey, object storage, Muse (section 14 deploy step 4). */
  app.get('/v1/ready', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'skipped' | string> = {};
    await Promise.all([
      (async () => {
        try {
          await getDb().execute(sql`select 1`);
          checks.database = 'ok';
        } catch (e) {
          checks.database = (e as Error).message;
        }
      })(),
      (async () => {
        try {
          checks.valkey = (await getRedis().ping()) === 'PONG' ? 'ok' : 'no pong';
        } catch (e) {
          checks.valkey = (e as Error).message;
        }
      })(),
    ]);
    checks.storage = s3Configured() ? 'ok' : 'skipped';
    checks.ai = env.AI_MODE === 'mock' ? 'skipped' : 'unchecked';
    const ok = Object.values(checks).every((v) => v === 'ok' || v === 'skipped' || v === 'unchecked');
    return reply.status(ok ? 200 : 503).send({ ok, checks });
  });

  for (const m of modules) {
    if (m.rootRoutes) await app.register(m.rootRoutes);
    if (m.routes) await app.register(m.routes, { prefix: '/v1' });
  }
  return app;
}

/** Run every module's setup() once per process. */
export async function setupModules() {
  for (const m of modules) await m.setup?.();
}
