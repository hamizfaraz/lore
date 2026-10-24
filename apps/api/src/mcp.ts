/** MCP entrypoint [C1 scaffold, frozen]: serves C2's MCP plugin at POST /mcp on MCP_PORT (mcp.ourlore.tech). */
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { setupModules } from './app';
import { env } from './lib/env';
import { registerErrorHandler } from './lib/errors';
import { loggerOptions } from './lib/logger';
import { initEmitter } from './lib/socket';
import { mcpPlugin } from './modules/mcp/server';

await setupModules();
initEmitter();
const app = Fastify({ logger: loggerOptions as any, trustProxy: true });
registerErrorHandler(app);
await app.register(cors, { origin: true, exposedHeaders: ['Mcp-Session-Id'] });
app.get('/health', async () => ({ ok: true, service: 'mcp' }));
await app.register(mcpPlugin);
await app.listen({ port: env.MCP_PORT, host: '0.0.0.0' });
