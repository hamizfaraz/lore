import { CalendarDays } from 'lucide-react';
import type { SpaceTab } from '@/features/groups/space/types';

/** `plans` Group Space tab [C2] — stub from the C1-0b scaffold. */
const tab: SpaceTab = {
  id: 'plans',
  label: 'Plans',
  icon: CalendarDays,
  owner: 'C2',
  href: ({ conversationId }) => `/c/${conversationId}/plans`,
};
export default tab;
