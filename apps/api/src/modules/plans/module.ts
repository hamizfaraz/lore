import { defineModule } from '../../lib/module';
import { registerCardResolver } from '../chat/service';
import { jobs } from './jobs';
import routes from './routes';
import { resolveConfirmedPlanCard, resolvePlanCard } from './service';

export default defineModule({
  name: 'plans',
  owner: 'C2',
  routes,
  jobs,
  setup: () => {
    registerCardResolver('plan_card', async (refId, ctx) =>
      ctx.viewerUserId ? resolvePlanCard(refId, ctx.viewerUserId) : undefined,
    );
    registerCardResolver('plan_confirmed', async (refId, ctx) =>
      ctx.viewerUserId ? resolveConfirmedPlanCard(refId, ctx.viewerUserId) : undefined,
    );
  },
});
