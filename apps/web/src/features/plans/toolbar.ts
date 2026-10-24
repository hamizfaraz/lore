import { CalendarDays } from 'lucide-react';
import type { ToolbarAction } from '@/features/chat/toolbar/types';

/** `plans` chat toolbar action [C2] — stub from the C1-0b scaffold; the owner may change `run`. */
const action: ToolbarAction = {
  id: 'plans',
  label: 'Plans',
  icon: CalendarDays,
  owner: 'C2',
  placements: ['header', 'sparkle', 'details'],
  run: (ctx) => {
    ctx.push(`/c/${ctx.conversationId}/plans`);
  },
};
export default action;
