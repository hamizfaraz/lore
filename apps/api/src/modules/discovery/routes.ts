import {
  zCommonGroundCardDTO,
  zDiscoveryOverviewDTO,
  zDiscoveryProfileBody,
  zDiscoveryProfileDTO,
  zIntroductionDTO,
  zIntroDecisionBody,
  zIntroRequestBody,
  zIntroStarterBody,
  zQuizAnswersBody,
} from '@lore/shared/dto/discovery';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import * as service from './service';

const routes: FastifyPluginAsync = async (app) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const params = z.object({ id: z.string().uuid() });

  api.get(
    '/discovery',
    { preHandler: requireUser, schema: { response: { 200: zDiscoveryOverviewDTO } } },
    (request) => service.getDiscoveryOverview(me(request).id),
  );
  api.get(
    '/discovery/profile',
    { preHandler: requireUser, schema: { response: { 200: zDiscoveryProfileDTO } } },
    (request) => service.getDiscoveryProfile(me(request).id),
  );
  api.put(
    '/discovery/profile',
    {
      preHandler: requireUser,
      schema: { body: zDiscoveryProfileBody, response: { 200: zDiscoveryProfileDTO } },
    },
    (request) => service.updateDiscoveryProfile(me(request).id, request.body),
  );
  api.put(
    '/discovery/quiz',
    { preHandler: requireUser, schema: { body: zQuizAnswersBody, response: { 200: zDiscoveryProfileDTO } } },
    (request) => service.saveDiscoveryQuiz(me(request).id, request.body),
  );
  api.get(
    '/discovery/matches',
    { preHandler: requireUser, schema: { response: { 200: z.array(zCommonGroundCardDTO) } } },
    (request) => service.listMatches(me(request).id),
  );
  api.get(
    '/discovery/introductions',
    { preHandler: requireUser, schema: { response: { 200: z.array(zIntroductionDTO) } } },
    (request) => service.listIntroductions(me(request).id),
  );
  api.post(
    '/discovery/introductions',
    { preHandler: requireUser, schema: { body: zIntroRequestBody, response: { 200: zIntroductionDTO } } },
    (request) =>
      service.requestIntroduction(me(request).id, request.body.toUserId, request.body.firstMessage),
  );
  api.patch(
    '/discovery/introductions/:id',
    {
      preHandler: requireUser,
      schema: { params, body: zIntroDecisionBody, response: { 200: zIntroductionDTO } },
    },
    (request) => service.decideIntroduction(request.params.id, me(request).id, request.body.action),
  );
  api.patch(
    '/discovery/introductions/:id/starter',
    {
      preHandler: requireUser,
      schema: { params, body: zIntroStarterBody, response: { 200: zIntroductionDTO } },
    },
    (request) =>
      service.editIntroductionStarter(request.params.id, me(request).id, request.body.firstMessage),
  );
};

export default routes;
