import type { JobProcessor } from '../../lib/module';

/** keepsakes BullMQ processors [C1]. Job names are `keepsakes.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
