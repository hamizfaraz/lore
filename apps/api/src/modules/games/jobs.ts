import type { JobProcessor } from '../../lib/module';
import { sweep, tick } from './service';

/** games BullMQ processors [C1]: turn/phase timers and abandonment after 10 min idle. */
export const jobs: Record<string, JobProcessor> = {
  'games.tick': async (job) => tick(job.data),
  'games.sweep': async () => sweep(),
};
