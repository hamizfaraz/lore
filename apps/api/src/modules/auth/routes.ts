import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { getAuth } from '../../lib/auth';
import { env } from '../../lib/env';

function toFetchRequest(req: FastifyRequest): Request {
  const url = new URL(req.url, env.BETTER_AUTH_URL);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined;
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? JSON.stringify(req.body) : undefined,
  });
}

/** Better Auth handler at /api/auth/* (email/password + Facebook) [C1]. Not under /v1. */
const rootRoutes: FastifyPluginAsync = async (app) => {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const res = await getAuth().handler(toFetchRequest(req));
      reply.status(res.status);
      res.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') return;
        reply.header(key, value);
      });
      const cookies = res.headers.getSetCookie?.() ?? [];
      if (cookies.length) reply.header('set-cookie', cookies);
      const text = await res.text();
      return reply.send(text || null);
    },
  });
};

export default rootRoutes;
