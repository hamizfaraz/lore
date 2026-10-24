import type { JobProcessor } from '../../lib/module';

/** podcast BullMQ processors [C2]. Job names are `podcast.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
