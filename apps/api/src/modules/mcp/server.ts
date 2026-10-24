import type { FastifyPluginAsync } from 'fastify';

/**
 * MCP streamable HTTP endpoint [C2] (plan section 8.13). Mounted at POST /mcp by src/mcp.ts.
 * C2 replaces this stub with McpServer + StreamableHTTPServerTransport (stateless, JSON responses).
 */
export const mcpPlugin: FastifyPluginAsync = async (app) => {
  app.post('/mcp', async (_req, reply) =>
    reply.status(501).send({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'LORE MCP server not implemented yet' },
      id: null,
    }),
  );
};
