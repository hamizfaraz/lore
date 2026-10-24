import type { JobProcessor } from '../../lib/module';

/** discovery BullMQ processors [C2]. Job names are `discovery.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
