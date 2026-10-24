import type { JobProcessor } from '../../lib/module';

/** voice BullMQ processors [C2]. Job names are `voice.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
