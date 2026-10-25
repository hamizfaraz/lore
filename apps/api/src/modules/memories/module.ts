import { defineModule } from '../../lib/module';
import { registerCardResolver } from '../chat/service';
import { jobs } from './jobs';
import routes from './routes';
import { getRecap } from './service';

export default defineModule({
  name: 'memories',
  owner: 'C2',
  routes,
  jobs,
  setup: () => {
    registerCardResolver('recap_card', async (refId, ctx) =>
      ctx.viewerUserId ? getRecap(refId, ctx.viewerUserId) : undefined,
    );
  },
});
