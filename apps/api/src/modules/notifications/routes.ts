import { zPushSubscriptionBody } from '@lore/shared/dto/notifications';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import { env } from '../../lib/env';
import * as svc from './service';

/** notifications REST routes [C1]. */
const routes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', requireUser);
  app.get(
    '/notifications',
    { schema: { querystring: z.object({ cursor: z.string().optional() }) } },
    async (req) => {
      const page = await svc.list(me(req).id, req.query.cursor);
      return { ...page, unread: await svc.unreadCount(me(req).id) };
    },
  );
  app.post(
    '/notifications/read',
    { schema: { body: z.object({ ids: z.array(z.string()).optional() }) } },
    async (req) => {
      await svc.markRead(me(req).id, req.body.ids);
      return { ok: true };
    },
  );
  app.get('/notifications/push-key', async () => ({ publicKey: env.VAPID_PUBLIC_KEY ?? null }));
  app.post('/notifications/push-subscriptions', { schema: { body: zPushSubscriptionBody } }, async (req) => {
    await svc.subscribePush(me(req).id, req.body);
    return { ok: true };
  });
};

export default routes;
