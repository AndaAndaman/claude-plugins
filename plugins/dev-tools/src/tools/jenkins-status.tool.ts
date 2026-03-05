import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { getBuildStatus, getQueueStatus } from '../shared/jenkins.js';

export function registerJenkinsStatusTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_status',
    'Check Jenkins build status. Pass a build URL to get status + console output, or a queue URL to check if the build has started.',
    {
      url: z.string().describe('Jenkins build URL or queue URL'),
      lines: z.number().optional().describe('Number of console lines to show (default: 20)'),
    },
    async (input) => {
      const url = (input.url as string).trim();
      const consoleLines = (input.lines as number) || 20;

      // Detect if this is a queue URL or build URL
      if (url.includes('/queue/')) {
        const q = getQueueStatus(url);
        if (q.buildUrl) {
          const status = getBuildStatus(q.buildUrl, consoleLines);
          return textResult(formatBuildStatus(status, consoleLines));
        }
        return textResult(`Build not started yet.\nReason: ${q.reason}\nQueue URL: ${url}`);
      }

      // Build URL
      const status = getBuildStatus(url, consoleLines);
      return textResult(formatBuildStatus(status, consoleLines));
    },
  );
}

function formatBuildStatus(status: ReturnType<typeof getBuildStatus>, lines: number): string {
  const parts: string[] = [];

  if (status.url) parts.push(`Build URL: ${status.url}`);
  if (status.number) parts.push(`Build #${status.number}`);

  if (status.building) {
    parts.push('Status: BUILDING...');
  } else {
    parts.push(`Status: ${status.result || 'UNKNOWN'}`);
  }

  if (status.consoleLines.length > 0) {
    parts.push('', `Console (last ${lines} lines):`, ...status.consoleLines);
  }

  return parts.join('\n');
}
