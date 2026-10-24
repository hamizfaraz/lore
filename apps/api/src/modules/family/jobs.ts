import type { JobProcessor } from '../../lib/module';

/** family BullMQ processors [C2]. Job names are `family.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
