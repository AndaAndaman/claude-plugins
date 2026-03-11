import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { BUILD_TARGETS, triggerBuild, getQueueStatus, getBuildStatus, loadJenkinsConfig, getEffectiveDefaults } from '../shared/jenkins.js';

// Only show these key params in build summary
const SUMMARY_KEYS = ['COMMIT_HASH', 'BUILD_BRANCH', 'BranchName', 'BUILD_SITE', 'SITE', 'STAGE', 'SERVICE_NAME', 'configuration'];

export function registerJenkinsBuildTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_build',
    `Trigger a Jenkins build. Targets: ${Object.keys(BUILD_TARGETS).join(', ')}. Example: {target: "ui"} or {target: "api", params: '{"COMMIT_HASH":"main"}'}`,
    {
      target: z.string().describe(`Build target: ${Object.keys(BUILD_TARGETS).join(', ')}`),
      params: z.string().optional().describe('JSON overrides, e.g. {"COMMIT_HASH":"main"}'),
      watch: z.coerce.boolean().optional().describe('Poll until build starts (boolean, default: false)'),
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
      const merged = { ...getEffectiveDefaults(target, bt, config), ...params };

      const lines: string[] = [
        `[${config.environment}] ${target}: ${bt.description}`,
        '',
      ];

      // Show all params that will be sent
      for (const [k, v] of Object.entries(merged)) {
        const isOverride = k in params;
        lines.push(`  ${k}: ${v || '""'}${isOverride ? ' (override)' : ''}`);
      }

      lines.push('');

      const result = triggerBuild(target, params);
      if (!result.success) {
        return errorResult(`${lines.join('\n')}\nFailed: ${result.error}`);
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
