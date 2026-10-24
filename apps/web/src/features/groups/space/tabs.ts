/** Group Space tabs registry — FROZEN after C1-0b (section 6). */
import memories from '@/features/memories/space-tab';
import plans from '@/features/plans/space-tab';
import chat from './chat';
import games from './games';
import groupPage from './group_page';
import type { SpaceTab } from './types';

export const spaceTabs: SpaceTab[] = [chat, plans, memories, games, groupPage];
