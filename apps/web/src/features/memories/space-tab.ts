import { Images } from 'lucide-react';
import type { SpaceTab } from '@/features/groups/space/types';

/** `memories` Group Space tab [C2] — stub from the C1-0b scaffold. */
const tab: SpaceTab = {
  id: 'memories',
  label: 'Memories',
  icon: Images,
  owner: 'C2',
  href: ({ conversationId }) => `/c/${conversationId}/memories`,
};
export default tab;
