import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { BUILD_TARGETS, loadJenkinsConfig, resolveJobPath, getBuildHistory, type BuildHistoryEntry } from '../shared/jenkins.js';

export function registerJenkinsHistoryTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_history',
    `Show recent build history for a target. Targets: ${Object.keys(BUILD_TARGETS).join(', ')}. Example: {target: "ui", count: 5}`,
    {
      target: z.string().describe(`Build target: ${Object.keys(BUILD_TARGETS).join(', ')}`),
      count: z.coerce.number().optional().describe('Number of recent builds to show (default: 10, max: 30)'),
    },
    async (input) => {
      const target = (input.target as string).trim().toLowerCase();
      const count = Math.min((input.count as number) || 10, 30);

      const bt = BUILD_TARGETS[target];
      if (!bt) {
        return errorResult(`Unknown target: ${target}. Available: ${Object.keys(BUILD_TARGETS).join(', ')}`);
      }

      const config = loadJenkinsConfig();
      if (!config.token) {
        return errorResult('Jenkins token not configured. Run jenkins_configure first.');
      }

      const jobPath = resolveJobPath(bt, config);
      const builds = getBuildHistory(jobPath, count);

      if (builds.length === 0) {
        return textResult(`No build history found for ${target} (${config.environment})`);
      }

      const lines: string[] = [
        `${target} — ${config.environment} — last ${builds.length} builds`,
        `Job: ${config.url}/job/${jobPath}/`,
        '',
      ];

      for (const b of builds) {
        lines.push(formatEntry(b, target));
      }

      return textResult(lines.join('\n'));
    },
  );
}

function formatEntry(b: BuildHistoryEntry, target: string): string {
  const state = b.building ? 'BUILDING' : (b.result || 'UNKNOWN');
  const icon = b.building ? '~' : b.result === 'SUCCESS' ? '+' : b.result === 'FAILURE' ? '!' : '?';
  const ago = timeAgo(b.timestamp);
  const dur = b.durationMs > 0 ? formatDuration(b.durationMs) : '';
  const user = b.user || '?';

  // Show the key identifying param per target type
  const branch = b.params['COMMIT_HASH'] || b.params['BranchName'] || b.params['BUILD_BRANCH'] || '';
  const service = b.params['SERVICE_NAME'] || b.params['lambda'] || '';

  const parts = [`[${icon}] #${b.number} ${state}`];
  if (branch) parts.push(branch);
  if (service) parts.push(`(${service})`);
  parts.push(`by ${user}`);
  parts.push(ago);
  if (dur) parts.push(dur);

  return parts.join('  ');
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m${remSecs}s`;
}
