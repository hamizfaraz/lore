import type { Server as HttpServer } from 'node:http';
import type { Job } from 'bullmq';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

export type JobProcessor = (job: Job) => Promise<unknown>;

/**
 * A LORE module (section 3): REST routes (mounted under /v1), BullMQ processors, repeatable jobs,
 * and optional boot hooks. modules/index.ts lists every module statically and is frozen after C1-0b;
 * owners change only their own module folder.
 */
export type LoreModule = {
  name: string;
  owner: 'C1' | 'C2';
  /** Fastify plugin registered under the /v1 prefix */
  routes?: FastifyPluginAsync;
  /** Routes registered at the root (no /v1 prefix), e.g. Better Auth at /api/auth/* */
  rootRoutes?: FastifyPluginAsync;
  /** job name (`<module>.<job>`) → processor; runs in the worker process */
  jobs?: Record<string, JobProcessor>;
  /** repeatable jobs scheduled by the worker, e.g. `persona.tick` every 120 s */
  repeatables?: { name: string; everyMs: number; data?: unknown }[];
  /** runs in every process at boot (register auth hooks, socket room guards, client handlers) */
  setup?: () => void | Promise<void>;
  /** api process only, after listen: attach raw http handlers (e.g. WS upgrade for /v1/voice/live) */
  attach?: (ctx: { app: FastifyInstance; http: HttpServer }) => void | Promise<void>;
};

export const defineModule = (m: LoreModule) => m;
