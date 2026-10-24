import type { JobProcessor } from '../../lib/module';

/** groups BullMQ processors [C1]. Job names are `groups.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
