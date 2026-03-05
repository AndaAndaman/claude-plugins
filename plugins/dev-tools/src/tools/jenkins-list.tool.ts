import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineTool, textResult } from '../shared/mcp-helpers.js';
import { BUILD_TARGETS, loadJenkinsConfig } from '../shared/jenkins.js';

export function registerJenkinsListTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_list_targets',
    'List all available Jenkins build targets with their default parameters.',
    {},
    async () => {
      const config = loadJenkinsConfig();
      const lines: string[] = [
        `Jenkins Build Targets (environment: ${config.environment})`,
        '='.repeat(50),
      ];

      for (const [key, target] of Object.entries(BUILD_TARGETS)) {
        const jobPath = target.jobPathOverride || config.jobPaths[target.jobPathKey];
        lines.push('');
        lines.push(`${key} — ${target.description}`);
        lines.push(`  Job: ${jobPath}`);
        lines.push('  Defaults:');
        for (const [k, v] of Object.entries(target.defaults)) {
          lines.push(`    ${k}: ${v || '<empty>'}`);
        }
      }

      lines.push('');
      lines.push('Usage: jenkins_build with target="<name>" and optional params to override defaults.');
      return textResult(lines.join('\n'));
    },
  );
}
