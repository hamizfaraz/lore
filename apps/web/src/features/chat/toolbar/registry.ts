/** Chat toolbar registry — FROZEN after C1-0b (section 6). Media, Voice, Games [C1]; Plans, Memories, AI [C2]. */
import memories from '@/features/memories/toolbar';
import ai from '@/features/persona/toolbar';
import plans from '@/features/plans/toolbar';
import games from './actions/games';
import media from './actions/media';
import voice from './actions/voice';
import type { ToolbarAction } from './types';

export const toolbarRegistry: ToolbarAction[] = [media, voice, games, plans, memories, ai];
