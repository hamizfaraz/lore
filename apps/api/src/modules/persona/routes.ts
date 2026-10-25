import {
  zMemoryDTO,
  zMemoryUpdateBody,
  zPersonaDTO,
  zPersonaExplanationDTO,
  zPersonaMuteBody,
  zPersonaTestBody,
  zPersonaTestResponse,
  zPersonaUpdateBody,
  zPersonaAvatarOptionsDTO,
  zPersonaAvatarSelectBody,
  zPersonaAvatarSelectionDTO,
} from '@lore/shared/dto/persona';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import * as service from './service';

/** persona REST routes [C2]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (app) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const conversationParams = z.object({ id: z.string().uuid() });
  const memoryParams = conversationParams.extend({ memoryId: z.string().uuid() });
  const explanationParams = conversationParams.extend({ messageId: z.string().uuid() });
  const mutationHeaders = z.object({ 'idempotency-key': z.string().min(1).optional() }).passthrough();

  api.get(
    '/conversations/:id/persona',
    {
      preHandler: requireUser,
      schema: {
        params: conversationParams,
        response: { 200: zPersonaDTO.nullable() },
      },
    },
    async (request) => service.getPersona(request.params.id, me(request).id),
  );

  api.put(
    '/conversations/:id/persona',
    {
      preHandler: requireUser,
      schema: {
        params: conversationParams,
        headers: mutationHeaders,
        body: zPersonaUpdateBody,
        response: { 200: zPersonaDTO },
      },
    },
    async (request) => service.updatePersona(request.params.id, me(request).id, request.body),
  );

  api.delete(
    '/conversations/:id/persona',
    {
      preHandler: requireUser,
      schema: { params: conversationParams, headers: mutationHeaders },
    },
    async (request, reply) => {
      await service.removePersona(request.params.id, me(request).id);
      return reply.status(204).send();
    },
  );

  api.post(
    '/conversations/:id/persona/test',
    {
      preHandler: requireUser,
      schema: {
        params: conversationParams,
        headers: mutationHeaders,
        body: zPersonaTestBody,
        response: { 200: zPersonaTestResponse },
      },
    },
    async (request) => service.testPersona(request.params.id, me(request).id, request.body),
  );

  api.post(
    '/conversations/:id/persona/avatars',
    {
      preHandler: requireUser,
      schema: { params: conversationParams, response: { 200: zPersonaAvatarOptionsDTO } },
    },
    async (request) => service.avatarOptions(request.params.id, me(request).id),
  );

  api.post(
    '/conversations/:id/persona/avatar',
    {
      preHandler: requireUser,
      schema: {
        params: conversationParams,
        body: zPersonaAvatarSelectBody,
        response: { 200: zPersonaAvatarSelectionDTO },
      },
    },
    async (request) => service.selectAvatar(request.params.id, me(request).id, request.body.style),
  );

  api.post(
    '/conversations/:id/persona/mute',
    {
      preHandler: requireUser,
      schema: {
        params: conversationParams,
        headers: mutationHeaders,
        body: zPersonaMuteBody,
        response: { 200: zPersonaDTO },
      },
    },
    async (request) => service.mutePersona(request.params.id, me(request).id, request.body),
  );

  api.get(
    '/conversations/:id/persona/memories',
    {
      preHandler: requireUser,
      schema: { params: conversationParams, response: { 200: z.array(zMemoryDTO) } },
    },
    async (request) => service.listMemories(request.params.id, me(request).id),
  );

  api.patch(
    '/conversations/:id/persona/memories/:memoryId',
    {
      preHandler: requireUser,
      schema: {
        params: memoryParams,
        headers: mutationHeaders,
        body: zMemoryUpdateBody,
        response: { 200: zMemoryDTO },
      },
    },
    async (request) =>
      service.updateMemory(request.params.id, request.params.memoryId, me(request).id, request.body),
  );

  api.delete(
    '/conversations/:id/persona/memories/:memoryId',
    {
      preHandler: requireUser,
      schema: { params: memoryParams, headers: mutationHeaders },
    },
    async (request, reply) => {
      await service.deleteMemory(request.params.id, request.params.memoryId, me(request).id);
      return reply.status(204).send();
    },
  );

  api.get(
    '/conversations/:id/persona/explanations/:messageId',
    {
      preHandler: requireUser,
      schema: {
        params: explanationParams,
        response: { 200: zPersonaExplanationDTO },
      },
    },
    async (request) => service.explanation(request.params.id, request.params.messageId, me(request).id),
  );
};

export default routes;
