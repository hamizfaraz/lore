import { Dices } from 'lucide-react';
import type { ToolbarAction } from '@/features/chat/toolbar/types';

/** `games` chat toolbar action [C1] — stub from the C1-0b scaffold; the owner may change `run`. */
const action: ToolbarAction = {
  id: 'games',
  label: 'Games',
  icon: Dices,
  owner: 'C1',
  placements: ['header', 'details'],
  run: (ctx) => {
    ctx.openSheet('games');
  },
};
export default action;
