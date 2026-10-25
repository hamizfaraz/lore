import {
  zConfirmBody,
  zPlanCardDTO,
  zPlanConfirmedCardDTO,
  zPlansOverviewDTO,
  zPreferenceBody,
  zPreferenceDTO,
  zRefineBody,
  zRsvpBody,
  zSuggestBody,
  zSuggestResult,
  zVoteBody,
} from '@lore/shared/dto/plans';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import { userActor } from '../../lib/actor';
import * as service from './service';

/** plans REST routes [C2]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (app) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const conversationParams = z.object({ id: z.string().uuid() });
  const proposalParams = z.object({ id: z.string().uuid() });
  const planParams = z.object({ id: z.string().uuid() });
  const mutationHeaders = z.object({ 'idempotency-key': z.string().min(1).optional() }).passthrough();

  api.get(
    '/conversations/:id/plans',
    {
      preHandler: requireUser,
      schema: { params: conversationParams, response: { 200: zPlansOverviewDTO } },
    },
    async (request) => service.listPlans(request.params.id, me(request).id),
  );

  api.post(
    '/conversations/:id/plans/suggest',
    {
      preHandler: requireUser,
      schema: {
        params: conversationParams,
        headers: mutationHeaders,
        body: zSuggestBody,
        response: { 200: zSuggestResult },
      },
    },
    async (request) => service.suggestPlans(request.params.id, me(request).id, request.body),
  );

  api.put(
    '/conversations/:id/plans/preferences',
    {
      preHandler: requireUser,
      schema: {
        params: conversationParams,
        headers: mutationHeaders,
        body: zPreferenceBody,
        response: { 200: zPreferenceDTO },
      },
    },
    async (request) => service.savePreference(request.params.id, me(request).id, request.body),
  );

  api.post(
    '/plans/:id/votes',
    {
      preHandler: requireUser,
      schema: {
        params: proposalParams,
        headers: mutationHeaders,
        body: zVoteBody,
        response: { 200: zPlanCardDTO },
      },
    },
    async (request) => service.voteOnPlan(request.params.id, userActor(me(request).id), request.body),
  );

  api.post(
    '/plans/:id/refine',
    {
      preHandler: requireUser,
      schema: {
        params: proposalParams,
        headers: mutationHeaders,
        body: zRefineBody,
        response: { 200: zPlanCardDTO },
      },
    },
    async (request) => service.refinePlan(request.params.id, me(request).id, request.body),
  );

  api.post(
    '/plans/:id/confirm',
    {
      preHandler: requireUser,
      schema: {
        params: proposalParams,
        headers: mutationHeaders,
        body: zConfirmBody,
        response: { 200: zPlanConfirmedCardDTO },
      },
    },
    async (request) => service.confirmPlan(request.params.id, me(request).id, request.body),
  );

  api.post(
    '/plans/:id/dismiss',
    {
      preHandler: requireUser,
      schema: { params: proposalParams, headers: mutationHeaders },
    },
    async (request, reply) => {
      await service.dismissPlan(request.params.id, me(request).id);
      return reply.status(204).send();
    },
  );

  api.post(
    '/group-plans/:id/rsvp',
    {
      preHandler: requireUser,
      schema: {
        params: planParams,
        headers: mutationHeaders,
        body: zRsvpBody,
        response: { 200: zPlanConfirmedCardDTO },
      },
    },
    async (request) => service.rsvpPlan(request.params.id, me(request).id, request.body.status),
  );

  api.get(
    '/group-plans/:id/calendar.ics',
    { preHandler: requireUser, schema: { params: planParams } },
    async (request, reply) => {
      const body = await service.planCalendar(request.params.id, me(request).id);
      return reply.type('text/calendar; charset=utf-8').send(body);
    },
  );
};

export default routes;
