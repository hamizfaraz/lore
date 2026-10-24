import type { LucideIcon } from 'lucide-react';

/** Group Space tab (Chat, Games, Group Page [C1]; Plans, Memories [C2]) shown as Details round buttons. */
export type SpaceTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  owner: 'C1' | 'C2';
  href: (ctx: { conversationId: string; groupHandle: string | null }) => string | null;
};
