import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { BUILD_TARGETS, triggerBuild, resolveQueue, getBuildStatus, loadJenkinsConfig, getEffectiveDefaults, setLastBuild, STAGING_JOBS, PREPROD_JOBS } from '../shared/jenkins.js';

export const registerJenkinsBuildTool = (server: McpServer): void => {
  defineTool(
    server,
    'jenkins_build',
    `Trigger a Jenkins build. Targets: ${Object.keys(BUILD_TARGETS).join(', ')}. Example: {target: "ui"} or {target: "api", params: '{"COMMIT_HASH":"main"}'}`,
    {
      target: z.string().describe(`Build target: ${Object.keys(BUILD_TARGETS).join(', ')}`),
      environment: z.enum(['staging', 'preprod']).optional().describe('Build environment. Overrides config for this build (default: from config)'),
      params: z.string().optional().describe('JSON overrides, e.g. {"COMMIT_HASH":"main"}'),
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

      // Override environment for this build if specified (without saving to config file)
      if (input.environment) {
        config.environment = input.environment as 'staging' | 'preprod';
        config.jobPaths = config.environment === 'preprod' ? { ...PREPROD_JOBS } : { ...STAGING_JOBS };
      }

      const merged = { ...getEffectiveDefaults(target, bt, config), ...params };

      const lines: string[] = [
        `[${config.environment}] ${target}: ${bt.description}`,
        '',
      ];

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

      // Store last build immediately
      setLastBuild({ target, queueUrl: result.queueUrl!, timestamp: Date.now() });

      // Resolve queue → build URL (blocks, but Claude should run this in background agent)
      if (result.queueUrl) {
        lines.push('Waiting for build to start...');
        const resolved = await resolveQueue(result.queueUrl);

        if (resolved.buildUrl) {
          const status = getBuildStatus(resolved.buildUrl, 10);
          const buildNum = status.number || '?';
          const state = status.building ? 'BUILDING' : status.result || 'UNKNOWN';

          setLastBuild({ target, queueUrl: result.queueUrl!, buildUrl: resolved.buildUrl, buildNumber: status.number ?? undefined, timestamp: Date.now() });

          lines.push(`Build #${buildNum} ${state} ${resolved.buildUrl}`);
          if (status.consoleLines.length > 0) {
            lines.push('--- console (last 10) ---');
            lines.push(...status.consoleLines);
          }
        } else if (resolved.cancelled) {
          lines.push('Build was cancelled in queue.');
        } else {
          lines.push(`${resolved.reason}. Use jenkins_status to check later.`);
        }
      }

      return textResult(lines.join('\n'));
    },
  );
}
