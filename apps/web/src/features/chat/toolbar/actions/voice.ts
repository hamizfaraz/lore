import { Mic } from 'lucide-react';
import type { ToolbarAction } from '@/features/chat/toolbar/types';

/** `voice` chat toolbar action [C1] — stub from the C1-0b scaffold; the owner may change `run`. */
const action: ToolbarAction = {
  id: 'voice',
  label: 'Voice',
  icon: Mic,
  owner: 'C1',
  placements: [],
  run: (ctx) => {
    ctx.openSheet('voice');
  },
};
export default action;
