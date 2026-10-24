/** API entrypoint [C1, frozen after C1-0b]: Fastify REST + Socket.IO on API_PORT. */
import { buildApp, setupModules } from './app';
import { closeDb } from './lib/db';
import { env } from './lib/env';
import { closeQueues } from './lib/queues';
import { closeRedis } from './lib/redis';
import { initIo } from './lib/socket';
import { modules } from './modules/index';

await setupModules();
const app = await buildApp();
initIo(app.server);
for (const m of modules) await m.attach?.({ app, http: app.server });
await app.listen({ port: env.API_PORT, host: '0.0.0.0' });

const shutdown = async () => {
  await app.close();
  await Promise.allSettled([closeQueues(), closeRedis(), closeDb()]);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
