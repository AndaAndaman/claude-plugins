import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult } from '../shared/mcp-helpers.js';
import { BUILD_TARGETS, PREPROD_OVERRIDES, loadJenkinsConfig, resolveJobPath } from '../shared/jenkins.js';

// Key params to show in summary (the rest are boilerplate)
const SUMMARY_KEYS = ['COMMIT_HASH', 'BranchName', 'BUILD_SITE', 'SITE', 'STAGE', 'SERVICE_NAME', 'configuration'];

export function registerJenkinsListTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_list_targets',
    'List available Jenkins build targets. Use verbose=true to see all parameters.',
    {
      verbose: z.boolean().optional().describe('Show all default parameters (default: false, shows summary)'),
    },
    async (input) => {
      const config = loadJenkinsConfig();
      const verbose = input.verbose === true;
      const lines: string[] = [
        `Jenkins Targets [${config.environment}]`,
        '',
      ];

      for (const [key, target] of Object.entries(BUILD_TARGETS)) {
        const envOverrides = config.environment === 'preprod'
          ? (PREPROD_OVERRIDES[key] || {})
          : {};
        const defaults = { ...target.defaults, ...envOverrides };

        if (verbose) {
          const jobPath = resolveJobPath(target, config);
          lines.push(`${key} — ${target.description} (${jobPath})`);
          for (const [k, v] of Object.entries(defaults)) {
            lines.push(`  ${k}: ${v || '<empty>'}`);
          }
          lines.push('');
        } else {
          const summary = SUMMARY_KEYS
            .filter(k => k in defaults)
            .map(k => `${k}=${defaults[k] || '""'}`)
            .join('  ');
          lines.push(`  ${key.padEnd(20)} ${summary}`);
        }
      }

      if (!verbose) {
        lines.push('');
        lines.push('Use verbose=true for full parameters.');
      }
      lines.push('Trigger: jenkins_build target="<name>" [params=\'{"KEY":"val"}\']');
      return textResult(lines.join('\n'));
    },
  );
}
