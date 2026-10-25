import { zCreateCommentBody, zCreatePostBody, zCreateStoryBody } from '@lore/shared/dto/social';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import { notFound } from '../../lib/errors';
import { idempotent } from '../../lib/idempotency';
import * as svc from './service';

const zId = z.object({ id: z.string().uuid() });
const zCursor = z.object({ cursor: z.string().optional() });

/** social REST routes [C1] (section 6). */
const routes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', requireUser);

  app.get('/accounts/:handle', { schema: { params: z.object({ handle: z.string() }) } }, async (req) =>
    svc.getProfile(req.params.handle, me(req).id),
  );
  app.get(
    '/accounts/:id/posts',
    {
      schema: {
        params: zId,
        querystring: zCursor.extend({ tab: z.enum(['posts', 'reels']).default('posts') }),
      },
    },
    async (req) => svc.accountPosts(req.params.id, req.query.tab, me(req).id, req.query.cursor),
  );
  app.get('/accounts/:id/owner', { schema: { params: zId } }, async (req) => {
    const a = await svc.accountById(req.params.id);
    if (!a?.ownerUserId) throw notFound('No owner');
    return { userId: a.ownerUserId };
  });
  app.post('/accounts/:id/follow', { schema: { params: zId } }, async (req) =>
    svc.follow(me(req).id, req.params.id),
  );
  app.delete('/accounts/:id/follow', { schema: { params: zId } }, async (req) =>
    svc.unfollow(me(req).id, req.params.id),
  );
  app.post('/accounts/:id/follow/approve', { schema: { params: zId } }, async (req) => {
    await svc.approveFollow(me(req).id, req.params.id);
    return { ok: true };
  });

  app.get('/feed', { schema: { querystring: zCursor } }, async (req) =>
    svc.feed(me(req).id, req.query.cursor),
  );
  app.get('/reels', { schema: { querystring: zCursor } }, async (req) =>
    svc.reels(me(req).id, req.query.cursor),
  );

  app.post('/posts', { schema: { body: zCreatePostBody } }, async (req) =>
    idempotent(req, 'posts', () => svc.createPost(me(req).id, req.body)),
  );
  app.get('/posts/:id', { schema: { params: zId } }, async (req) => svc.getPost(req.params.id, me(req).id));
  app.delete('/posts/:id', { schema: { params: zId } }, async (req) => {
    await svc.deletePost(me(req).id, req.params.id);
    return { ok: true };
  });
  app.post('/posts/:id/like', { schema: { params: zId } }, async (req) =>
    svc.like(me(req).id, req.params.id, true),
  );
  app.delete('/posts/:id/like', { schema: { params: zId } }, async (req) =>
    svc.like(me(req).id, req.params.id, false),
  );
  app.post('/posts/:id/save', { schema: { params: zId } }, async (req) =>
    svc.save(me(req).id, req.params.id, true),
  );
  app.delete('/posts/:id/save', { schema: { params: zId } }, async (req) =>
    svc.save(me(req).id, req.params.id, false),
  );
  app.post('/posts/:id/share', { schema: { params: zId } }, async (req) => {
    await svc.share(me(req).id, req.params.id);
    return { ok: true };
  });
  app.get('/posts/:id/comments', { schema: { params: zId } }, async (req) => ({
    items: await svc.listComments(me(req).id, req.params.id),
    nextCursor: null,
  }));
  app.post('/posts/:id/comments', { schema: { params: zId, body: zCreateCommentBody } }, async (req) =>
    idempotent(req, `comment:${req.params.id}`, () =>
      svc.addComment(me(req).id, req.params.id, req.body.body),
    ),
  );

  app.get('/stories/rail', async (req) => svc.storyRail(me(req).id));
  app.get('/stories/by-account/:id', { schema: { params: zId } }, async (req) =>
    svc.accountStories(me(req).id, req.params.id),
  );
  app.post('/stories', { schema: { body: zCreateStoryBody } }, async (req) =>
    idempotent(req, 'stories', () => svc.createStory(me(req).id, req.body)),
  );
  app.post('/stories/:id/view', { schema: { params: zId } }, async (req) => {
    await svc.viewStory(me(req).id, req.params.id);
    return { ok: true };
  });
};

export default routes;
