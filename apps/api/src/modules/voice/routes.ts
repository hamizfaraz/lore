import { zTranscribeBody, zTranscribeResult } from '@lore/shared/dto/voice';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import { requestTranscription } from './service';

/** voice REST routes [C2]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (app) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/voice/transcribe',
    {
      preHandler: requireUser,
      schema: {
        headers: z.object({ 'idempotency-key': z.string().min(1).optional() }).passthrough(),
        body: zTranscribeBody,
        response: { 200: zTranscribeResult },
      },
    },
    async (request) => requestTranscription(request.body.mediaId, me(request).id),
  );
};

export default routes;
