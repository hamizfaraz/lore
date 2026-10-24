import type { JobProcessor } from '../../lib/module';

/** impact BullMQ processors [C2]. Job names are `impact.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
