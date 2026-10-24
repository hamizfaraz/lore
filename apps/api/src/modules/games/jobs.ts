import type { JobProcessor } from '../../lib/module';

/** games BullMQ processors [C1]. Job names are `games.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
