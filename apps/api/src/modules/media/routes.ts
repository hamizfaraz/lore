import { zPresignBody } from '@lore/shared/dto/media';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import { badRequest, forbidden } from '../../lib/errors';
import * as storage from '../../lib/storage';
import * as svc from './service';

const zLocal = z.object({ key: z.string(), exp: z.coerce.number(), sig: z.string() });

/** media REST routes [C1]. */
const routes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();

  app.post('/media/presign', { preHandler: requireUser, schema: { body: zPresignBody } }, async (req) =>
    svc.presign(me(req).id, req.body),
  );

  app.post(
    '/media/alt-text',
    {
      preHandler: requireUser,
      schema: { body: z.object({ caption: z.string().max(2200).optional() }) },
    },
    async (req) => svc.suggestAltText(req.body.caption ?? ''),
  );

  app.post(
    '/media/:id/complete',
    { preHandler: requireUser, schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => svc.complete(me(req).id, req.params.id),
  );

  // ── Local storage fallback (dev without S3): signed PUT upload and signed GET ─────────────────
  await app.register(async (scoped) => {
    scoped.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: 50 * 1024 * 1024 }, (_req, body, done) =>
      done(null, body),
    );
    scoped.put('/media/local/upload', { schema: { querystring: zLocal } }, async (req, reply) => {
      const { key, exp, sig } = req.query as z.infer<typeof zLocal>;
      if (storage.usingS3()) throw badRequest('Local storage disabled');
      if (exp < Date.now() / 1000 || !storage.verify(`put:${key}:${exp}`, sig))
        throw forbidden('Upload URL expired');
      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest('Empty upload');
      await storage.putObject(key, body, String(req.headers['content-type'] ?? 'application/octet-stream'));
      return reply.status(200).send({ ok: true });
    });
  });

  app.get('/media/local/file', { schema: { querystring: zLocal } }, async (req, reply) => {
    const { key, exp, sig } = req.query;
    if (exp < Date.now() / 1000 || !storage.verify(`get:${key}:${exp}`, sig)) throw forbidden('Link expired');
    const buf = await storage.getObject(key).catch(() => null);
    if (!buf) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    const ext = key.split('.').pop() ?? '';
    const types: Record<string, string> = {
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
      m4a: 'audio/mp4',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
    };
    reply.header('cache-control', 'private, max-age=3600');
    reply.type(types[ext] ?? 'application/octet-stream');
    return reply.send(buf);
  });
};

export default routes;
