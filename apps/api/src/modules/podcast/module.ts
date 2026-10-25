import { defineModule } from '../../lib/module';
import { registerCardResolver } from '../chat/service';
import { jobs } from './jobs';
import routes from './routes';
import { resolvePodcastInvite } from './service';

export default defineModule({
  name: 'podcast',
  owner: 'C2',
  routes,
  jobs,
  setup: () => {
    registerCardResolver('podcast_invite', async (refId, ctx) =>
      ctx.viewerUserId ? resolvePodcastInvite(refId, ctx.viewerUserId) : undefined,
    );
  },
});
