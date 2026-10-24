import type { JobProcessor } from '../../lib/module';

/** plans BullMQ processors [C2]. Job names are `plans.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
