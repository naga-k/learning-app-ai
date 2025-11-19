import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { createGeneratePlanTool } from '@/lib/ai/tools/generate-plan';
import { createGenerateCourseTool } from '@/lib/ai/tools/generate-course';
import { getModel } from '@/lib/ai/provider';

const handler = createMcpHandler(
    async (server) => {
        // ------------------------------
        // Simple Tool for Verification
        // ------------------------------
        server.registerTool(
            'add',
            {
                description: 'Adds two numbers together',
                inputSchema: z.object({ a: z.number(), b: z.number() }).shape as any,
            },
            async (args: any) => {
                const { a, b } = args;
                return {
                    content: [{ type: 'text' as const, text: String(a + b) }],
                };
            },
        );

        // ------------------------------
        // Real Project Tools
        // ------------------------------
        const planTool = createGeneratePlanTool({
            model: getModel('plan'),
        });

        server.registerTool(
            'generate_plan',
            {
                description: planTool.description,
                inputSchema: planTool.inputSchema.shape as any,
            },
            async (args: any) => {
                const result = await planTool.execute(args);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );
    },
    {
        serverInfo: {
            name: 'Learning App MCP Server',
            version: '1.0.0',
        },
    },
    {
        streamableHttpEndpoint: '/api/mcp',
        sseEndpoint: '/api/mcp/sse',
        sseMessageEndpoint: '/api/mcp/messages',
    },
);

const wrappedHandler = async (req: Request) => {
    console.log(`[MCP] ${req.method} ${req.url}`);
    const response = await handler(req);
    console.log(`[MCP] Response status: ${response.status}`);
    return response;
};

export { wrappedHandler as GET, wrappedHandler as POST, wrappedHandler as DELETE };
