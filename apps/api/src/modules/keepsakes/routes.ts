import { zCreateKeepsakeBody } from '@lore/shared/dto/keepsakes';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import * as svc from './service';

const zId = z.object({ id: z.string().uuid() });

/** keepsakes REST routes [C1]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  // Public: the devnet asset URI. No session, so Explorer can read it.
  app.get('/keepsakes/:id/metadata', { schema: { params: zId } }, async (req, reply) => {
    reply.header('cache-control', 'public, max-age=60');
    return svc.publicMetadata(req.params.id);
  });

  await app.register(async (scoped) => {
    scoped.addHook('preHandler', requireUser);
    const authed = scoped.withTypeProvider<ZodTypeProvider>();
    authed.post('/keepsakes', { schema: { body: zCreateKeepsakeBody } }, async (req) =>
      svc.requestKeepsake(me(req).id, req.body.recapId),
    );
    authed.get('/keepsakes/by-recap/:id', { schema: { params: zId } }, async (req) => ({
      keepsake: await svc.forRecap(req.params.id, me(req).id),
    }));
    authed.get('/keepsakes/:id', { schema: { params: zId } }, async (req) =>
      svc.view(req.params.id, me(req).id),
    );
  });
};

export default routes;
