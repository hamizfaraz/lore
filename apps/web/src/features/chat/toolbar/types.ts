import type { LucideIcon } from 'lucide-react';

export type ToolbarContext = {
  conversationId: string;
  meUserId: string;
  isGroup: boolean;
  /** navigate inside the app (push) */
  push: (href: string) => void;
  /** open a feature sheet registered by the owner */
  openSheet: (id: string, props?: Record<string, unknown>) => void;
};

/** Chat toolbar action (Media · Voice · Games · Plans · Memories · AI), section 6. */
export type ToolbarAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  owner: 'C1' | 'C2';
  /** shown in the chat header (Plans/Games), in the ✦ sparkle menu, or in Details round buttons */
  placements: ('header' | 'sparkle' | 'details')[];
  run: (ctx: ToolbarContext) => void | Promise<void>;
};
