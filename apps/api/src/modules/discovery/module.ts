import { defineModule } from '../../lib/module';
import { registerCardResolver } from '../chat/service';
import { jobs } from './jobs';
import routes from './routes';
import { resolveIntroductionCard } from './service';

export default defineModule({
  name: 'discovery',
  owner: 'C2',
  routes,
  jobs,
  repeatables: [{ name: 'discovery.refresh-profiles', everyMs: 60 * 60 * 1000 }],
  setup: () => {
    registerCardResolver('intro_card', async (refId, ctx) =>
      ctx.viewerUserId ? resolveIntroductionCard(refId, ctx.viewerUserId) : undefined,
    );
  },
});
