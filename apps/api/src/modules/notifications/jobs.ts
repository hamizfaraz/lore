import type { JobProcessor } from '../../lib/module';

/** notifications BullMQ processors [C1]. Job names are `notifications.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
