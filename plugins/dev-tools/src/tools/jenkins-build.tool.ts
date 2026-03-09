import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { BUILD_TARGETS, PREPROD_OVERRIDES, triggerBuild, getQueueStatus, getBuildStatus, loadJenkinsConfig } from '../shared/jenkins.js';

// Only show these key params in build summary
const SUMMARY_KEYS = ['COMMIT_HASH', 'BranchName', 'BUILD_SITE', 'SITE', 'STAGE', 'SERVICE_NAME', 'configuration'];

export function registerJenkinsBuildTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_build',
    `Trigger a Jenkins build. Targets: ${Object.keys(BUILD_TARGETS).join(', ')}. Use watch=true to poll until build starts.`,
    {
      target: z.string().describe(`Build target: ${Object.keys(BUILD_TARGETS).join(', ')}`),
      params: z.string().optional().describe('JSON overrides, e.g. {"COMMIT_HASH":"main"}'),
      watch: z.boolean().optional().describe('Wait for build to start (default: false)'),
    },
    async (input) => {
      const target = input.target as string;

      if (!BUILD_TARGETS[target]) {
        return errorResult(`Unknown target: ${target}. Available: ${Object.keys(BUILD_TARGETS).join(', ')}`);
      }

      let params: Record<string, string> = {};
      if (input.params) {
        try {
          params = JSON.parse(input.params as string);
        } catch {
          return errorResult('Invalid params JSON.');
        }
      }

      const bt = BUILD_TARGETS[target];
      const config = loadJenkinsConfig();
      const envOverrides = config.environment === 'preprod'
        ? (PREPROD_OVERRIDES[target] || {})
        : {};
      const configOverrides = config.targetDefaults?.[target] || {};
      const merged = { ...bt.defaults, ...envOverrides, ...configOverrides, ...params };

      // Compact summary: only key params + any user overrides
      const showKeys = new Set([...SUMMARY_KEYS, ...Object.keys(params)]);
      const summary = Object.entries(merged)
        .filter(([k]) => showKeys.has(k))
        .map(([k, v]) => `${k}=${v || '""'}`)
        .join('  ');

      const lines: string[] = [
        `[${config.environment}] ${target}: ${summary}`,
      ];

      const result = triggerBuild(target, params);
      if (!result.success) {
        return errorResult(`${lines[0]}\nFailed: ${result.error}`);
      }

      lines.push(`Queued: ${result.queueUrl}`);

      if (input.watch === true && result.queueUrl) {
        const maxWait = 60000;
        const start = Date.now();

        while (Date.now() - start < maxWait) {
          const q = getQueueStatus(result.queueUrl);
          if (q.buildUrl) {
            const status = getBuildStatus(q.buildUrl, 10);
            lines.push(`Build #${status.number || '?'} ${status.building ? 'BUILDING' : status.result || 'UNKNOWN'} ${q.buildUrl}`);
            if (status.consoleLines.length > 0) {
              lines.push('--- console (last 10) ---');
              lines.push(...status.consoleLines);
            }
            return textResult(lines.join('\n'));
          }
          await new Promise(r => setTimeout(r, 3000));
        }

        lines.push('Timed out. Use jenkins_status with queue URL.');
      }

      return textResult(lines.join('\n'));
    },
  );
}
