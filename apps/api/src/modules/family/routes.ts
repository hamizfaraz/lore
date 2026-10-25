import {
  zCreateFamilyStoryBody,
  zFamilyContributionBody,
  zFamilyShareBody,
  zFamilyStoryDetailDTO,
} from '@lore/shared/dto/family';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import * as service from './service';

/** family REST routes [C2]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (app) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const storyParams = z.object({ id: z.string().uuid() });
  const sourceParams = storyParams.extend({ sourceMessageId: z.string().uuid() });
  const conversationParams = z.object({ conversationId: z.string().uuid() });

  api.post(
    '/conversations/:conversationId/family-stories',
    {
      preHandler: requireUser,
      schema: {
        params: conversationParams,
        body: zCreateFamilyStoryBody,
        response: { 200: zFamilyStoryDetailDTO },
      },
    },
    (request) => service.createFamilyStory(request.params.conversationId, me(request).id, request.body),
  );
  api.get(
    '/family-stories/:id',
    {
      preHandler: requireUser,
      schema: { params: storyParams, response: { 200: zFamilyStoryDetailDTO } },
    },
    (request) => service.getFamilyStory(request.params.id, me(request).id),
  );
  api.patch(
    '/family-stories/:id/sources/:sourceMessageId',
    {
      preHandler: requireUser,
      schema: {
        params: sourceParams,
        body: zFamilyContributionBody,
        response: { 200: zFamilyStoryDetailDTO },
      },
    },
    (request) =>
      service.updateFamilySource(
        request.params.id,
        request.params.sourceMessageId,
        me(request).id,
        request.body,
      ),
  );
  api.post(
    '/family-stories/:id/generate',
    {
      preHandler: requireUser,
      schema: { params: storyParams, response: { 200: zFamilyStoryDetailDTO } },
    },
    (request) => service.generateFamilyStory(request.params.id, me(request).id),
  );
  api.post(
    '/family-stories/:id/share',
    { preHandler: requireUser, schema: { params: storyParams, body: zFamilyShareBody } },
    (request) => service.shareFamilyStory(request.params.id, me(request).id, request.body),
  );
};

export default routes;
