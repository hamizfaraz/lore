import { UserSquare } from 'lucide-react';
import type { SpaceTab } from '@/features/groups/space/types';

/** `group_page` Group Space tab [C1] — stub from the C1-0b scaffold. */
const tab: SpaceTab = {
  id: 'group_page',
  label: 'Group page',
  icon: UserSquare,
  owner: 'C1',
  href: ({ conversationId, groupHandle }) =>
    groupHandle ? `/g/${groupHandle}` : `/c/${conversationId}/settings#group-account`,
};
export default tab;
