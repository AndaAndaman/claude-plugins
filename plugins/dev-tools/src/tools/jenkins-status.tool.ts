import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult } from '../shared/mcp-helpers.js';
import { getBuildStatus, getQueueStatus } from '../shared/jenkins.js';

export function registerJenkinsStatusTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_status',
    'Check Jenkins build or queue status with console output. Example: {url: "https://jenkins.example.com/job/build/123", lines: 30}',
    {
      url: z.string().describe('Jenkins build URL or queue URL'),
      lines: z.coerce.number().optional().describe('Console lines to show (number, default: 20)'),
    },
    async (input) => {
      const url = (input.url as string).trim();
      const numLines = (input.lines as number) || 20;

      if (url.includes('/queue/')) {
        const q = getQueueStatus(url);
        if (q.buildUrl) {
          return textResult(formatStatus(getBuildStatus(q.buildUrl, numLines)));
        }
        return textResult(`Queued: ${q.reason}`);
      }

      return textResult(formatStatus(getBuildStatus(url, numLines)));
    },
  );
}

function formatStatus(s: ReturnType<typeof getBuildStatus>): string {
  const state = s.building ? 'BUILDING' : (s.result || 'UNKNOWN');
  const parts = [`#${s.number || '?'} ${state} ${s.url || ''}`];
  if (s.consoleLines.length > 0) {
    parts.push('--- console ---', ...s.consoleLines);
  }
  return parts.join('\n');
}
