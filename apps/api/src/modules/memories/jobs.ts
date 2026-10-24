import type { JobProcessor } from '../../lib/module';

/** memories BullMQ processors [C2]. Job names are `memories.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
