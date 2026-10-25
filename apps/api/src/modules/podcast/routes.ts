import {
  zBranchBody,
  zCreateShowBody,
  zPodcastShowDetailDTO,
  zVoiceContributionBody,
} from '@lore/shared/dto/podcast';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import * as service from './service';

/** podcast REST routes [C2]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (app) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const showParams = z.object({ showId: z.string().uuid() });
  const stationParams = showParams.extend({ stationId: z.string().uuid() });

  api.post(
    '/podcasts',
    {
      preHandler: requireUser,
      schema: { body: zCreateShowBody, response: { 200: zPodcastShowDetailDTO } },
    },
    (request) => service.createPodcast(request.body.conversationId, request.body.title, me(request).id),
  );
  api.get(
    '/podcasts/:showId',
    {
      preHandler: requireUser,
      schema: { params: showParams, response: { 200: zPodcastShowDetailDTO } },
    },
    (request) => service.getPodcast(request.params.showId, me(request).id),
  );
  api.post(
    '/podcasts/:showId/stations/:stationId/contributions',
    {
      preHandler: requireUser,
      schema: {
        params: stationParams,
        body: zVoiceContributionBody,
        response: { 200: zPodcastShowDetailDTO },
      },
    },
    (request) =>
      service.contributePodcast(
        request.params.showId,
        request.params.stationId,
        me(request).id,
        request.body,
      ),
  );
  api.post(
    '/podcasts/:showId/stations/:stationId/branches',
    {
      preHandler: requireUser,
      schema: { params: stationParams, body: zBranchBody, response: { 200: zPodcastShowDetailDTO } },
    },
    (request) =>
      service.branchPodcast(
        request.params.showId,
        request.params.stationId,
        me(request).id,
        request.body.topic,
      ),
  );
  api.post(
    '/podcasts/:showId/wrap',
    {
      preHandler: requireUser,
      schema: { params: showParams, response: { 200: zPodcastShowDetailDTO } },
    },
    (request) => service.wrapPodcast(request.params.showId, me(request).id),
  );
  api.post(
    '/podcasts/:showId/finish',
    {
      preHandler: requireUser,
      schema: { params: showParams, response: { 200: zPodcastShowDetailDTO } },
    },
    (request) => service.finishPodcast(request.params.showId, me(request).id),
  );
  api.get(
    '/podcasts/:showId/audio',
    { preHandler: requireUser, schema: { params: showParams } },
    async (request, reply) => {
      const audio = await service.podcastAudio(request.params.showId, me(request).id);
      return reply
        .type('audio/mpeg')
        .header('content-disposition', `inline; filename="lore-${request.params.showId}.mp3"`)
        .send(audio);
    },
  );
};

export default routes;
