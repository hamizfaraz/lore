import {
  zCreateRecapBody,
  zPatchRecapBody,
  zProposePostBody,
  zRecapCardDTO,
  zRecapConsentBody,
  zRecapListDTO,
  zShareRecapBody,
} from '@lore/shared/dto/memories';
import { zDraftCardDTO } from '@lore/shared/dto/groups';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import * as service from './service';

/** memories REST routes [C2]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (app) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const conversationParams = z.object({ id: z.string().uuid() });
  const recapParams = z.object({ id: z.string().uuid() });
  const mutationHeaders = z.object({ 'idempotency-key': z.string().min(1).optional() }).passthrough();

  api.get(
    '/conversations/:id/recaps',
    {
      preHandler: requireUser,
      schema: { params: conversationParams, response: { 200: zRecapListDTO } },
    },
    async (request) => service.listRecaps(request.params.id, me(request).id),
  );

  api.post(
    '/conversations/:id/recaps',
    {
      preHandler: requireUser,
      schema: {
        params: conversationParams,
        headers: mutationHeaders,
        body: zCreateRecapBody,
        response: { 200: zRecapCardDTO },
      },
    },
    async (request) => service.createRecap(request.params.id, me(request).id, request.body),
  );

  api.get(
    '/recaps/:id',
    { preHandler: requireUser, schema: { params: recapParams, response: { 200: zRecapCardDTO } } },
    async (request) => service.getRecap(request.params.id, me(request).id),
  );

  api.patch(
    '/recaps/:id',
    {
      preHandler: requireUser,
      schema: {
        params: recapParams,
        headers: mutationHeaders,
        body: zPatchRecapBody,
        response: { 200: zRecapCardDTO },
      },
    },
    async (request) => service.patchRecap(request.params.id, me(request).id, request.body),
  );

  api.post(
    '/recaps/:id/consent',
    {
      preHandler: requireUser,
      schema: {
        params: recapParams,
        headers: mutationHeaders,
        body: zRecapConsentBody,
        response: { 200: zRecapCardDTO },
      },
    },
    async (request) =>
      service.setRecapConsent(request.params.id, me(request).id, request.body.mediaId, request.body.include),
  );

  api.post(
    '/recaps/:id/propose-post',
    {
      preHandler: requireUser,
      schema: {
        params: recapParams,
        headers: mutationHeaders,
        body: zProposePostBody,
        response: { 200: zDraftCardDTO },
      },
    },
    async (request) => service.proposeRecapPost(request.params.id, me(request).id, request.body),
  );

  api.post(
    '/recaps/:id/share',
    {
      preHandler: requireUser,
      schema: {
        params: recapParams,
        headers: mutationHeaders,
        body: zShareRecapBody,
        response: { 200: zRecapCardDTO },
      },
    },
    async (request) => service.shareRecap(request.params.id, me(request).id, request.body),
  );

  api.post(
    '/recaps/:id/save',
    {
      preHandler: requireUser,
      schema: { params: recapParams, headers: mutationHeaders, response: { 200: zRecapCardDTO } },
    },
    async (request) => service.saveRecap(request.params.id, me(request).id),
  );
};

export default routes;
