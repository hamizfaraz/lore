/**
 * Static module registry — FROZEN after C1-0b (plan section 10). Owners edit only their module folders.
 * Order matters only for route registration logs.
 */
import type { LoreModule } from '../lib/module';
import auth from './auth/module';
import users from './users/module';
import social from './social/module';
import media from './media/module';
import chat from './chat/module';
import groups from './groups/module';
import games from './games/module';
import notifications from './notifications/module';
import graph from './graph/module';
import keepsakes from './keepsakes/module';
import persona from './persona/module';
import plans from './plans/module';
import memories from './memories/module';
import family from './family/module';
import podcast from './podcast/module';
import discovery from './discovery/module';
import impact from './impact/module';
import mcp from './mcp/module';
import voice from './voice/module';

export const modules: LoreModule[] = [
  auth,
  users,
  social,
  media,
  chat,
  groups,
  games,
  notifications,
  graph,
  keepsakes,
  persona,
  plans,
  memories,
  family,
  podcast,
  discovery,
  impact,
  mcp,
  voice,
];
