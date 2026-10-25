import type { JobProcessor } from '../../lib/module';
import { syncImpact } from './service';

/** impact BullMQ processors [C2]. Job names are `impact.<job>`. */
export const jobs: Record<string, JobProcessor> = {
  'impact.sync': async () => syncImpact(),
};
