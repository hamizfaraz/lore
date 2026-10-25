import {
  zApprovalBody,
  zCreateDraftBody,
  zCreateGroupAccountBody,
  zPatchDraftBody,
  zPolicyInput,
} from '@lore/shared/dto/groups';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { me, requireUser } from '../../lib/auth';
import { idempotent } from '../../lib/idempotency';
import * as svc from './service';

const zId = z.object({ id: z.string().uuid() });

/** groups REST routes [C1] (section 6). */
const routes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', requireUser);
  app.post(
    '/conversations/:id/group-account',
    { schema: { params: zId, body: zCreateGroupAccountBody } },
    async (req) => svc.createGroupAccount(req.params.id, me(req).id, req.body),
  );
  app.get('/accounts/:id/policy', { schema: { params: zId } }, async (req) =>
    svc.getPolicy(req.params.id, me(req).id),
  );
  app.put('/accounts/:id/policy', { schema: { params: zId, body: zPolicyInput } }, async (req) =>
    svc.putPolicy(req.params.id, me(req).id, req.body),
  );
  app.get('/accounts/:id/drafts', { schema: { params: zId } }, async (req) => ({
    items: await svc.listDrafts(req.params.id, me(req).id),
  }));
  app.post('/drafts', { schema: { body: zCreateDraftBody } }, async (req) =>
    idempotent(req, 'drafts', () =>
      svc.createDraft(
        {
          ...req.body,
          source: req.body.source ? { kind: req.body.source.kind, id: req.body.source.id } : undefined,
        },
        { type: 'user', userId: me(req).id },
      ),
    ),
  );
  app.get('/drafts/:id', { schema: { params: zId } }, async (req) => svc.getDraft(req.params.id, me(req).id));
  app.patch('/drafts/:id', { schema: { params: zId, body: zPatchDraftBody } }, async (req) =>
    svc.patchDraft(req.params.id, me(req).id, req.body),
  );
  app.post('/drafts/:id/submit', { schema: { params: zId } }, async (req) =>
    svc.submit(req.params.id, { type: 'user', userId: me(req).id }),
  );
  app.post('/drafts/:id/approvals', { schema: { params: zId, body: zApprovalBody } }, async (req) =>
    svc.decide(req.params.id, me(req).id, req.body.decision, req.body.note),
  );
  app.post('/drafts/:id/publish', { schema: { params: zId } }, async (req) =>
    svc.publish(req.params.id, me(req).id),
  );
  app.post('/drafts/:id/cancel', { schema: { params: zId } }, async (req) =>
    svc.cancel(req.params.id, me(req).id),
  );
};

export default routes;
