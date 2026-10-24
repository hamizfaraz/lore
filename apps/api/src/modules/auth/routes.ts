import type { FastifyPluginAsync } from 'fastify';

/** auth REST routes [C1]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (_app) => {
  // TODO(C1): routes for the auth module (plan section 6 REST surface)
};

export default routes;
