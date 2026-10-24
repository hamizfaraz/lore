import type { JobProcessor } from '../../lib/module';

/** media BullMQ processors [C1]. Job names are `media.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
