import type { JobProcessor } from '../../lib/module';

/** chat BullMQ processors [C1]. Job names are `chat.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
