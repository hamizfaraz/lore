import { randomBytes } from 'node:crypto';
import { eq, user } from '@lore/db';
import {
  zAddMembersBody,
  zCreateConversationBody,
  zMuteBody,
  zReactionBody,
  zRoleBody,
  zSendMessageBody,
} from '@lore/shared/dto/chat';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getAuth, me, requireUser } from '../../lib/auth';
import { getDb } from '../../lib/db';
import { idempotent } from '../../lib/idempotency';
import * as svc from './service';

const zId = z.object({ id: z.string().uuid() });

/** chat REST routes [C1] (section 6). */
const routes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();

  // ── public: guest join for judges (/join/[slug]) ──
  app.get('/join/:slug', { schema: { params: z.object({ slug: z.string() }) } }, async (req) =>
    svc.joinInfo(req.params.slug),
  );
  app.post(
    '/join/:slug',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ slug: z.string() }),
        body: z.object({ code: z.string(), name: z.string().min(1).max(40).optional() }),
      },
    },
    async (req, reply) => {
      const existing = await import('../../lib/auth').then((a) => a.sessionFromHeaders(req.headers));
      let userId = existing?.id;
      if (!userId) {
        // Create a 2-hour guest account and sign it in (cookies forwarded to the browser).
        const email = `guest-${randomBytes(5).toString('hex')}@guest.ourlore.tech`;
        const res = await getAuth().api.signUpEmail({
          body: {
            email,
            password: randomBytes(18).toString('base64url'),
            name: req.body.name?.trim() || 'Guest',
          },
          returnHeaders: true,
        });
        const cookies = res.headers.getSetCookie?.() ?? [];
        if (cookies.length) reply.header('set-cookie', cookies);
        userId = res.response.user.id;
        await getDb()
          .update(user)
          .set({ guestExpiresAt: new Date(Date.now() + 2 * 3600_000) })
          .where(eq(user.id, userId));
        const { requirePersonalAccount } = await import('../users/service');
        const acct = await requirePersonalAccount(userId);
        const { socialAccounts } = await import('@lore/db');
        await getDb()
          .update(socialAccounts)
          .set({ onboardedAt: new Date() })
          .where(eq(socialAccounts.id, acct.id));
      }
      return svc.joinWithCode(req.params.slug, req.body.code, userId);
    },
  );

  // ── authenticated ──
  await app.register(async (authed) => {
    const a = authed.withTypeProvider<ZodTypeProvider>();
    a.addHook('preHandler', requireUser);

    a.get('/conversations', async (req) => ({ items: await svc.inbox(me(req).id), nextCursor: null }));
    a.post('/conversations', { schema: { body: zCreateConversationBody } }, async (req) =>
      idempotent(req, 'conv', () => svc.createConversation(me(req).id, req.body)),
    );
    a.get('/conversations/:id', { schema: { params: zId } }, async (req) =>
      svc.getConversation(req.params.id, me(req).id),
    );
    a.patch(
      '/conversations/:id',
      { schema: { params: zId, body: z.object({ title: z.string().min(1).max(60) }) } },
      async (req) => {
        await svc.rename(req.params.id, me(req).id, req.body.title);
        return svc.getConversation(req.params.id, me(req).id);
      },
    );
    a.get(
      '/conversations/:id/messages',
      {
        schema: {
          params: zId,
          querystring: z.object({
            before: z.string().uuid().optional(),
            after: z.string().uuid().optional(),
          }),
        },
      },
      async (req) => svc.listMessages(req.params.id, me(req).id, req.query.before, req.query.after),
    );
    a.post('/conversations/:id/messages', { schema: { params: zId, body: zSendMessageBody } }, async (req) =>
      svc.send(req.params.id, me(req).id, req.body),
    );
    a.post('/conversations/:id/read', { schema: { params: zId } }, async (req) => {
      await svc.markRead(req.params.id, me(req).id);
      return { ok: true };
    });
    a.post('/conversations/:id/members', { schema: { params: zId, body: zAddMembersBody } }, async (req) => ({
      items: await svc.addMembers(req.params.id, me(req).id, req.body.userIds),
    }));
    a.delete(
      '/conversations/:id/members/:userId',
      { schema: { params: zId.extend({ userId: z.string().uuid() }) } },
      async (req) => ({
        items: await svc.removeMember(req.params.id, me(req).id, req.params.userId),
      }),
    );
    a.patch(
      '/conversations/:id/members/:userId/role',
      { schema: { params: zId.extend({ userId: z.string().uuid() }), body: zRoleBody } },
      async (req) => ({
        items: await svc.setRole(req.params.id, me(req).id, req.params.userId, req.body.role),
      }),
    );
    a.patch('/conversations/:id/mute', { schema: { params: zId, body: zMuteBody } }, async (req) => ({
      items: await svc.mute(req.params.id, me(req).id, req.body),
    }));
    a.patch(
      '/conversations/:id/me',
      {
        schema: {
          params: zId,
          body: z.object({ aiHistoryConsent: z.boolean().optional(), pinned: z.boolean().optional() }),
        },
      },
      async (req) => {
        if (req.body.aiHistoryConsent !== undefined)
          await svc.setAiConsent(req.params.id, me(req).id, req.body.aiHistoryConsent);
        if (req.body.pinned !== undefined) await svc.pin(req.params.id, me(req).id, req.body.pinned);
        return { ok: true };
      },
    );
    a.get('/conversations/:id/media', { schema: { params: zId } }, async (req) => ({
      items: await svc.sharedMedia(req.params.id, me(req).id),
    }));
    a.post('/conversations/:id/join-link', { schema: { params: zId } }, async (req) =>
      svc.createJoinLink(req.params.id, me(req).id),
    );

    a.post('/messages/:id/reactions', { schema: { params: zId, body: zReactionBody } }, async (req) =>
      svc.react(me(req).id, req.params.id, req.body.emoji, true),
    );
    a.delete(
      '/messages/:id/reactions/:emoji',
      { schema: { params: zId.extend({ emoji: z.string() }) } },
      async (req) => svc.react(me(req).id, req.params.id, decodeURIComponent(req.params.emoji), false),
    );
    a.delete('/messages/:id', { schema: { params: zId } }, async (req) =>
      svc.unsend(me(req).id, req.params.id),
    );
  });
};

export default routes;
