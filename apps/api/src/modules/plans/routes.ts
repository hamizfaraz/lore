import type { FastifyPluginAsync } from 'fastify';

/** plans REST routes [C2]. Mounted under /v1 by modules/index.ts. */
const routes: FastifyPluginAsync = async (_app) => {
  // TODO(C2): routes for the plans module (plan section 6 REST surface)
};

export default routes;
