import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

type ToolContent = { type: 'text'; text: string };
type ToolResult = { content: ToolContent[]; isError?: boolean };

export function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

export function defineTool<T extends Record<string, z.ZodTypeAny>>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: T,
  handler: (input: z.objectOutputType<T, z.ZodTypeAny>) => Promise<ToolResult>,
): void {
  server.registerTool(name, { description, inputSchema }, handler);
}
