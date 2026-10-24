import type { JobProcessor } from '../../lib/module';

/** users BullMQ processors [C1]. Job names are `users.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
