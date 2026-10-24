import { Image } from 'lucide-react';
import type { ToolbarAction } from '@/features/chat/toolbar/types';

/** `media` chat toolbar action [C1] — stub from the C1-0b scaffold; the owner may change `run`. */
const action: ToolbarAction = {
  id: 'media',
  label: 'Media',
  icon: Image,
  owner: 'C1',
  placements: ['details'],
  run: (ctx) => {
    ctx.push(`/c/${ctx.conversationId}/details#media`);
  },
};
export default action;
