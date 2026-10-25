import { zImpactSummaryDTO } from '@lore/shared/dto/impact';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getImpactSummary } from './service';

/** Public aggregate-only route: no account, group, or message fields are returned. */
const routes: FastifyPluginAsync = async (app) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.get('/impact/summary', { schema: { response: { 200: zImpactSummaryDTO } } }, getImpactSummary);
};

export default routes;
