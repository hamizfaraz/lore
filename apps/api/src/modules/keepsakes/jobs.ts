import type { Job } from 'bullmq';
import type { JobProcessor } from '../../lib/module';
import { mintKeepsake } from './service';

/** keepsakes BullMQ processors [C1]. Job names are `keepsakes.<job>`. */
export const jobs: Record<string, JobProcessor> = {
  'keepsakes.mint': async (job: Job) => {
    const { keepsakeId } = job.data as { keepsakeId: string };
    return mintKeepsake(keepsakeId);
  },
};
