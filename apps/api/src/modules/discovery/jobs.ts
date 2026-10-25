import type { JobProcessor } from '../../lib/module';
import { refreshDiscoverableProfiles } from './service';

/** discovery BullMQ processors [C2]. Job names are `discovery.<job>`. */
export const jobs: Record<string, JobProcessor> = {
  'discovery.refresh-profiles': async () => refreshDiscoverableProfiles(),
};
