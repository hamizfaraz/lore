import { Sparkles } from 'lucide-react';
import type { ToolbarAction } from '@/features/chat/toolbar/types';

/** `ai` chat toolbar action [C2] — stub from the C1-0b scaffold; the owner may change `run`. */
const action: ToolbarAction = {
  id: 'ai',
  label: 'Ask Milo',
  icon: Sparkles,
  owner: 'C2',
  placements: ['sparkle'],
  run: (ctx) => {
    ctx.push(`/c/${ctx.conversationId}/ai`);
  },
};
export default action;
