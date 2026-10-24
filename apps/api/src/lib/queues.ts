import { type JobsOptions, Queue } from 'bullmq';
import { createRedis } from './redis';

/**
 * One BullMQ queue per module (section 4). Job names are `<module>.<job>`, e.g. `persona.consider`;
 * the queue is the prefix. Processors are registered via each module's `jobs.ts` (see modules/index.ts).
 */
export const QUEUE_NAMES = [
  'media',
  'chat',
  'groups',
  'games',
  'notifications',
  'graph',
  'keepsakes',
  'persona',
  'plans',
  'memories',
  'family',
  'podcast',
  'discovery',
  'impact',
  'voice',
  'image',
  'embed',
] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

const queues = new Map<string, Queue>();
let connection: ReturnType<typeof createRedis> | null = null;

export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    connection ??= createRedis({ bullmq: true });
    q = new Queue(name, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 1000,
        attempts: 2,
        backoff: { type: 'exponential', delay: 500 },
      },
    });
    queues.set(name, q);
  }
  return q;
}

/** Enqueue `<module>.<job>`. `debounceKey` + `delayMs` gives "debounced N s per conversation" behavior. */
export async function enqueue(
  jobName: string,
  data: unknown,
  opts: JobsOptions & { debounceKey?: string; delayMs?: number } = {},
) {
  const queue = getQueue(jobName.split('.')[0] as QueueName);
  const { debounceKey, delayMs, ...rest } = opts;
  if (debounceKey) {
    return queue.add(jobName, data, {
      ...rest,
      delay: delayMs ?? 0,
      deduplication: {
        id: `${jobName}:${debounceKey}`,
        ttl: delayMs ?? 1000,
        extend: true,
        replace: true,
      } as any,
    });
  }
  return queue.add(jobName, data, { ...rest, delay: delayMs });
}

export async function closeQueues() {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
  await connection?.quit().catch(() => {});
  connection = null;
}
