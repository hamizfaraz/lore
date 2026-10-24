import { MessageCircle } from 'lucide-react';
import type { SpaceTab } from '@/features/groups/space/types';

/** `chat` Group Space tab [C1] — stub from the C1-0b scaffold. */
const tab: SpaceTab = {
  id: 'chat',
  label: 'Chat',
  icon: MessageCircle,
  owner: 'C1',
  href: ({ conversationId }) => `/c/${conversationId}`,
};
export default tab;
