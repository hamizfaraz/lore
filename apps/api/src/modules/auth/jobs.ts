import type { JobProcessor } from '../../lib/module';

/** auth BullMQ processors [C1]. Job names are `auth.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
