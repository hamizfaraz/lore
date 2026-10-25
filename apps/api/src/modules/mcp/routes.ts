import { zCreateTokenBody, zCreateTokenResult, zTokenListDTO } from '@lore/shared/dto/mcp';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import * as service from './service';

/** mcp REST routes [C2]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (app) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const tokenParams = z.object({ id: z.string().uuid() });

  api.get(
    '/mcp/tokens',
    { preHandler: requireUser, schema: { response: { 200: zTokenListDTO } } },
    async (request) => service.listTokens(me(request).id),
  );

  api.post(
    '/mcp/tokens',
    {
      preHandler: requireUser,
      schema: { body: zCreateTokenBody, response: { 201: zCreateTokenResult } },
    },
    async (request, reply) => reply.status(201).send(await service.createToken(me(request).id, request.body)),
  );

  api.delete(
    '/mcp/tokens/:id',
    { preHandler: requireUser, schema: { params: tokenParams } },
    async (request, reply) => {
      await service.revokeToken(me(request).id, request.params.id);
      return reply.status(204).send();
    },
  );
};

export default routes;
