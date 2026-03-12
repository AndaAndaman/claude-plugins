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

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// MCP SDK's tool/registerTool generics cause tsc infinite recursion with zod schemas.
// Handler receives Record<string, unknown> — callers use `as` casts for field access.
export function defineTool(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: Record<string, z.ZodTypeAny>,
  handler: (input: Record<string, unknown>) => Promise<ToolResult>,
): void {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  (server.tool as Function)(name, description, inputSchema, handler);
}
