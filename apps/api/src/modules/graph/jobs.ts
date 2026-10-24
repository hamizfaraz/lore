import type { JobProcessor } from '../../lib/module';

/** graph BullMQ processors [C1]. Job names are `graph.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
