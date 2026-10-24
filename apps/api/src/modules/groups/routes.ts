import type { FastifyPluginAsync } from 'fastify';

/** groups REST routes [C1]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (_app) => {
  // TODO(C1): routes for the groups module (plan section 6 REST surface)
};

export default routes;
