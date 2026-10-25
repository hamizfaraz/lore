import { defineModule } from '../../lib/module';
import { registerCardResolver } from '../chat/service';
import { jobs } from './jobs';
import routes from './routes';
import { resolveFamilyStoryCard } from './service';

export default defineModule({
  name: 'family',
  owner: 'C2',
  routes,
  jobs,
  setup: () => {
    registerCardResolver('family_story_card', async (refId, ctx) =>
      ctx.viewerUserId ? resolveFamilyStoryCard(refId, ctx.viewerUserId) : undefined,
    );
  },
});
