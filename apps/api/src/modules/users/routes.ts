import { zMe, zUpdateProfileBody } from '@lore/shared/dto/users';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import * as svc from './service';

/** users REST routes [C1]: /me, /me/profile, handle check, people search. */
const routes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', requireUser);

  app.get('/me', { schema: { response: { 200: zMe } } }, async (req) => svc.getMe(me(req)));

  app.patch('/me/profile', { schema: { body: zUpdateProfileBody } }, async (req) =>
    svc.updateProfile(me(req).id, req.body),
  );

  app.get(
    '/handles/:handle/available',
    { schema: { params: z.object({ handle: z.string() }) } },
    async (req) => {
      const h = req.params.handle.toLowerCase();
      const acct = await svc.getPersonalAccount(me(req).id);
      const valid = /^[a-z0-9._]{2,30}$/.test(h);
      return { handle: h, available: valid && !(await svc.isHandleTaken(h, acct?.id)) };
    },
  );

  app.get(
    '/users/search',
    { schema: { querystring: z.object({ q: z.string().min(1).max(60) }) } },
    async (req) => ({
      items: await svc.searchPeople(req.query.q, me(req).id),
    }),
  );
};

export default routes;
