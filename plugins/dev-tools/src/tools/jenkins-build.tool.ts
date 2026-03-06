import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { BUILD_TARGETS, PREPROD_OVERRIDES, triggerBuild, getQueueStatus, getBuildStatus, loadJenkinsConfig } from '../shared/jenkins.js';

export function registerJenkinsBuildTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_build',
    `Trigger a Jenkins build. Available targets: ${Object.keys(BUILD_TARGETS).join(', ')}. Pass params as JSON to override defaults. Returns queue URL. Use watch=true to wait for build to start and return build URL.`,
    {
      target: z.string().describe(`Build target: ${Object.keys(BUILD_TARGETS).join(', ')}`),
      params: z.string().optional().describe('JSON object of parameter overrides, e.g. {"COMMIT_HASH":"main","SITE":"acc"}'),
      watch: z.boolean().optional().describe('Wait for build to start and return build URL (default: false)'),
    },
    async (input) => {
      const target = input.target as string;

      if (!BUILD_TARGETS[target]) {
        return errorResult(`Unknown target: ${target}\nAvailable: ${Object.keys(BUILD_TARGETS).join(', ')}`);
      }

      // Parse params
      let params: Record<string, string> = {};
      if (input.params) {
        try {
          params = JSON.parse(input.params as string);
        } catch {
          return errorResult('Invalid params JSON. Expected: {"KEY":"value", ...}');
        }
      }

      // Show what we're building (with environment-aware defaults)
      const bt = BUILD_TARGETS[target];
      const config = loadJenkinsConfig();
      const envOverrides = config.environment === 'preprod'
        ? (PREPROD_OVERRIDES[target] || {})
        : {};
      const merged = { ...bt.defaults, ...envOverrides, ...params };
      const lines: string[] = [
        `Triggering ${bt.description}...`,
        'Parameters:',
        ...Object.entries(merged).map(([k, v]) => `  ${k}: ${v || '<empty>'}`),
        '',
      ];

      // Trigger
      const result = triggerBuild(target, params);
      if (!result.success) {
        return errorResult(`${lines.join('\n')}Build trigger failed: ${result.error}`);
      }

      lines.push(`Build queued: ${result.queueUrl}`);

      // Optionally wait for build to start
      if (input.watch === true && result.queueUrl) {
        lines.push('Waiting for build to start...');

        const maxWait = 60000; // 60s max
        const start = Date.now();

        while (Date.now() - start < maxWait) {
          const q = getQueueStatus(result.queueUrl);
          if (q.buildUrl) {
            lines.push(`Build started: ${q.buildUrl}`);

            // Get initial status
            const status = getBuildStatus(q.buildUrl, 10);
            if (status.number) lines.push(`Build #${status.number}`);
            if (status.building) {
              lines.push('Status: BUILDING');
            } else {
              lines.push(`Status: ${status.result || 'UNKNOWN'}`);
            }
            if (status.consoleLines.length > 0) {
              lines.push('', 'Console (last 10 lines):');
              lines.push(...status.consoleLines);
            }
            return textResult(lines.join('\n'));
          }

          lines.push(`  Queue: ${q.reason}`);
          // Wait 3s between polls
          await new Promise(r => setTimeout(r, 3000));
        }

        lines.push('Timed out waiting for build to start. Use jenkins_status with the queue URL to check later.');
      }

      return textResult(lines.join('\n'));
    },
  );
}
