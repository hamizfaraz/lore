import type { JobProcessor } from '../../lib/module';

/** persona BullMQ processors [C2]. Job names are `persona.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
