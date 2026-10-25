import type { JobProcessor } from '../../lib/module';
import { expireGuests } from './service';

/** chat BullMQ processors [C1]. */
export const jobs: Record<string, JobProcessor> = {
  'chat.expireGuests': async () => ({ expired: await expireGuests() }),
};
