import { zCreateGameBody, zGameActionBody } from '@lore/shared/dto/games';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import { idempotent } from '../../lib/idempotency';
import * as svc from './service';

const zId = z.object({ id: z.string().uuid() });

/** games REST routes [C1] (section 6). */
const routes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', requireUser);
  app.post('/games', { schema: { body: zCreateGameBody } }, async (req) =>
    idempotent(req, 'games', () => svc.create(me(req).id, req.body)),
  );
  app.get('/games/:id', { schema: { params: zId } }, async (req) => svc.view(req.params.id, me(req).id));
  app.post('/games/:id/join', { schema: { params: zId } }, async (req) =>
    svc.join(req.params.id, me(req).id),
  );
  app.post('/games/:id/start', { schema: { params: zId } }, async (req) =>
    svc.start(req.params.id, me(req).id),
  );
  app.post('/games/:id/actions', { schema: { params: zId, body: zGameActionBody } }, async (req) =>
    svc.act(req.params.id, me(req).id, req.body),
  );
  app.get('/conversations/:id/games', { schema: { params: zId } }, async (req) => ({
    items: await svc.activeGames(req.params.id, me(req).id),
  }));
};

export default routes;
