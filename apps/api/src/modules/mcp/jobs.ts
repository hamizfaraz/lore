import type { JobProcessor } from '../../lib/module';

/** mcp BullMQ processors [C2]. Job names are `mcp.<job>`. */
export const jobs: Record<string, JobProcessor> = {};
