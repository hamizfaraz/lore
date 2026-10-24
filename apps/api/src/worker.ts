/** Worker entrypoint [C1, frozen after C1-0b]: one BullMQ Worker per module queue + repeatable jobs. */
import { type Job, Worker } from 'bullmq';
import { setupModules } from './app';
import { closeDb } from './lib/db';
import { logger } from './lib/logger';
import type { JobProcessor } from './lib/module';
import { QUEUE_NAMES, closeQueues, getQueue } from './lib/queues';
import { createRedis } from './lib/redis';
import { initEmitter } from './lib/socket';
import { modules } from './modules/index';

await setupModules();
initEmitter();

const processors = new Map<string, JobProcessor>();
for (const m of modules) for (const [name, fn] of Object.entries(m.jobs ?? {})) processors.set(name, fn);

const connection = createRedis({ bullmq: true });
const workers = QUEUE_NAMES.map((queue) =>
  new Worker(
    queue,
    async (job: Job) => {
      const fn = processors.get(job.name);
      if (!fn) {
        logger.warn({ job: job.name }, 'no processor registered');
        return null;
      }
      return fn(job);
    },
    { connection, concurrency: 4 },
  ).on('failed', (job, err) => logger.error({ job: job?.name, err: err.message }, 'job failed')),
);

for (const m of modules) {
  for (const r of m.repeatables ?? []) {
    await getQueue(r.name.split('.')[0] as (typeof QUEUE_NAMES)[number]).upsertJobScheduler(
      r.name,
      { every: r.everyMs },
      { name: r.name, data: r.data ?? {} },
    );
  }
}
logger.info({ processors: [...processors.keys()] }, 'worker ready');

const shutdown = async () => {
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled([closeQueues(), closeDb()]);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
