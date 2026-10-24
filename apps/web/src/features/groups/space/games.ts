import { Dices } from 'lucide-react';
import type { SpaceTab } from '@/features/groups/space/types';

/** `games` Group Space tab [C1] — stub from the C1-0b scaffold. */
const tab: SpaceTab = {
  id: 'games',
  label: 'Games',
  icon: Dices,
  owner: 'C1',
  href: ({ conversationId }) => `/c/${conversationId}?games=1`,
};
export default tab;
