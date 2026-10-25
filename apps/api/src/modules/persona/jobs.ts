import type { JobProcessor } from '../../lib/module';
import { consider, tick } from './service';
import type { ConsiderInput } from './types';

/** persona BullMQ processors [C2]. Job names are `persona.<job>`. */
export const jobs: Record<string, JobProcessor> = {
  'persona.consider': async (job) => consider(job.data as ConsiderInput),
  'persona.tick': async () => tick(),
};
