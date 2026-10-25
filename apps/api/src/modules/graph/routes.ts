import { zConfirmGraphTagsBody } from '@lore/shared/dto/graph';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { me, requireUser } from '../../lib/auth';
import * as svc from './service';

/** graph REST routes [C1]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', requireUser);
  app.post('/graph/import', async (req) => svc.importForUser(me(req).id));
  app.get('/graph/connections', async (req) => svc.connections(me(req).id));
  app.post('/graph/suggestions', { schema: { body: zConfirmGraphTagsBody } }, async (req) =>
    svc.confirmSuggestions(me(req).id, req.body.tags),
  );
  app.post('/graph/disconnect', async (req) => svc.disconnect(me(req).id));
};

export default routes;
