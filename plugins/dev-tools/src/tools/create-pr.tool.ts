/**
 * MCP Tool: create_pr — create a pull request on GitHub (mock implementation).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerCreatePrTool(server: McpServer): void {
  server.registerTool(
    'create_pr',
    {
      description: 'Create a pull request on GitHub. Returns a mock PR URL.',
      inputSchema: {
        title: z.string().describe('Title of the pull request'),
        branch: z.string().describe('Source branch for the pull request'),
      },
    },
    async (input) => {
      const result = {
        pr_url: 'https://github.com/example/repo/pull/999',
        status: 'mock',
        title: input.title,
        branch: input.branch,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
