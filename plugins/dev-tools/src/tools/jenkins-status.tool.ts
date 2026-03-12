import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { getBuildStatus, getQueueStatus, getLastBuild, setLastBuild } from '../shared/jenkins.js';

export function registerJenkinsStatusTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_status',
    'Check Jenkins build or queue status with console output. If no URL provided, checks the last triggered build. Example: {url: "https://jenkins.example.com/job/build/123", lines: 30}',
    {
      url: z.string().optional().describe('Jenkins build URL or queue URL (omit to check last build)'),
      lines: z.coerce.number().optional().describe('Console lines to show (number, default: 20)'),
    },
    async (input) => {
      let url = ((input.url as string) || '').trim();
      const numLines = (input.lines as number) || 20;
      const last = getLastBuild();

      // If no URL, use last build state
      if (!url) {
        if (!last) {
          return errorResult('No URL provided and no recent build found. Provide a build or queue URL.');
        }
        // Background monitor may have resolved the build URL already
        if (last.buildUrl) {
          const status = getBuildStatus(last.buildUrl, numLines);
          setLastBuild({ ...last, buildNumber: status.number ?? last.buildNumber });
          return textResult(formatStatus(status));
        }
        url = last.queueUrl;
      }

      // Queue URL → check if background already resolved it, otherwise poll once
      if (url.includes('/queue/')) {
        // Check if background monitor already resolved this queue
        if (last && last.queueUrl === url && last.buildUrl) {
          const status = getBuildStatus(last.buildUrl, numLines);
          setLastBuild({ ...last, buildNumber: status.number ?? last.buildNumber });
          return textResult(formatStatus(status));
        }

        const q = getQueueStatus(url);
        if (q.buildUrl) {
          if (last && last.queueUrl === url) {
            const status = getBuildStatus(q.buildUrl, numLines);
            setLastBuild({ ...last, buildUrl: q.buildUrl, buildNumber: status.number ?? undefined });
            return textResult(formatStatus(status));
          }
          return textResult(formatStatus(getBuildStatus(q.buildUrl, numLines)));
        }
        if (q.cancelled) {
          return textResult('Build was cancelled in queue.');
        }
        return textResult(`Queued: ${q.reason}`);
      }

      const status = getBuildStatus(url, numLines);
      if (last && (last.buildUrl === url || !last.buildUrl)) {
        setLastBuild({ ...last, buildUrl: url, buildNumber: status.number ?? last.buildNumber });
      }
      return textResult(formatStatus(status));
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
