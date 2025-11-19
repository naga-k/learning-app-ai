import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { createGeneratePlanTool } from '@/lib/ai/tools/generate-plan';
import { createGenerateCourseTool } from '@/lib/ai/tools/generate-course';
import { getModel } from '@/lib/ai/provider';

const handler = createMcpHandler(
    async (server) => {
        // ------------------------------
        // Learning App AI Tools
        // ------------------------------
        const planTool = createGeneratePlanTool({
            model: getModel('plan'),
        });

        server.tool(
            'generate_plan',
            planTool.description,
            planTool.inputSchema.shape,
            async (args: any) => {
                const result = await planTool.execute(args);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            },
        );

        const courseTool = createGenerateCourseTool({
            userId: 'mcp-user', // Default user ID for MCP calls
            sessionId: 'mcp-session', // Default session ID for MCP calls
        });

        server.tool(
            'generate_course',
            courseTool.description,
            courseTool.inputSchema.shape,
            async (args: any) => {
                const result = await courseTool.execute(args);
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
