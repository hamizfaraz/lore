import type { FastifyPluginAsync } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MCP_TOOLS, type McpToolName, McpService, mcpService } from './service';
import type { McpPrincipal } from './types';

export function createMcpServer(principal: McpPrincipal, service: McpService = mcpService): McpServer {
  const server = new McpServer({ name: 'LORE', version: '1.0.0' });
  for (const name of Object.keys(MCP_TOOLS) as McpToolName[]) {
    const spec = MCP_TOOLS[name];
    server.registerTool(
      name,
      { description: spec.description, inputSchema: spec.schema },
      async (input: Record<string, unknown>) => {
        try {
          const result = await service.execute(name, principal, input);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: error instanceof Error ? error.message : 'LORE tool failed',
              },
            ],
          };
        }
      },
    );
  }
  return server;
}

/**
 * MCP streamable HTTP endpoint [C2] (plan section 8.13). Mounted at POST /mcp by src/mcp.ts.
 * C2 replaces this stub with McpServer + StreamableHTTPServerTransport (stateless, JSON responses).
 */
export const mcpPlugin: FastifyPluginAsync = async (app) => {
  app.post('/mcp', async (request, reply) => {
    const authorization = Array.isArray(request.headers.authorization)
      ? request.headers.authorization[0]
      : request.headers.authorization;
    const principal = await mcpService.authenticate(authorization);
    const server = createMcpServer(principal);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    reply.hijack();
    try {
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } finally {
      await server.close();
    }
  });
};
