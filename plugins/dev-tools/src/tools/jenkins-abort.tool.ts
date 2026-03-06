import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { abortBuild } from '../shared/jenkins.js';

export function registerJenkinsAbortTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_abort',
    'Abort/cancel a Jenkins build or queued item. Pass the build URL or queue URL.',
    {
      url: z.string().describe('Jenkins build URL or queue URL to abort'),
    },
    async (input) => {
      const url = (input.url as string).trim();
      const result = abortBuild(url);

      if (result.success) {
        const type = url.includes('/queue/') ? 'Queued item cancelled' : 'Build aborted';
        return textResult(`${type}: ${url}`);
      }

      return errorResult(`Failed to abort: ${result.error}`);
    },
  );
}
