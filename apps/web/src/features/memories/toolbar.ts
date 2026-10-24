import { Images } from 'lucide-react';
import type { ToolbarAction } from '@/features/chat/toolbar/types';

/** `memories` chat toolbar action [C2] — stub from the C1-0b scaffold; the owner may change `run`. */
const action: ToolbarAction = {
  id: 'memories',
  label: 'Memories',
  icon: Images,
  owner: 'C2',
  placements: ['sparkle', 'details'],
  run: (ctx) => {
    ctx.push(`/c/${ctx.conversationId}/memories`);
  },
};
export default action;
