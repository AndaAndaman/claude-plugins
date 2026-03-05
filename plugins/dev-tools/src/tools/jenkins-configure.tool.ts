import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult } from '../shared/mcp-helpers.js';
import { loadJenkinsConfig, saveJenkinsConfig, getJenkinsConfigPath } from '../shared/jenkins.js';

export function registerJenkinsConfigureTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_configure',
    'Configure Jenkins connection settings. Call without arguments to see current config. Settings persist to ~/.config/dev-tools/jenkins.json.',
    {
      url: z.string().optional().describe('Jenkins base URL'),
      user: z.string().optional().describe('Jenkins API username'),
      token: z.string().optional().describe('Jenkins API token'),
      environment: z.enum(['staging', 'preprod']).optional().describe('Environment — switches job paths automatically'),
    },
    async (input) => {
      const before = loadJenkinsConfig();
      let changed = false;

      const updates: Record<string, unknown> = {};
      if (input.environment !== undefined) { updates.environment = input.environment; changed = true; }
      if (input.url !== undefined) { updates.url = input.url; changed = true; }
      if (input.user !== undefined) { updates.user = input.user; changed = true; }
      if (input.token !== undefined) { updates.token = input.token; changed = true; }

      if (changed) {
        saveJenkinsConfig(updates as any);
      }

      const after = loadJenkinsConfig();
      const tokenDisplay = after.token ? after.token.slice(0, 6) + '...' : '<not set>';

      if (!changed) {
        return textResult([
          `Jenkins configuration (${getJenkinsConfigPath()}):`,
          `  url:         ${after.url}`,
          `  user:        ${after.user}`,
          `  token:       ${tokenDisplay}`,
          `  environment: ${after.environment}`,
          `  job paths:`,
          `    ui:     ${after.jobPaths.ui}`,
          `    api:    ${after.jobPaths.api}`,
          `    lambda: ${after.jobPaths.lambda}`,
        ].join('\n'));
      }

      const lines = [`Jenkins configuration updated (${getJenkinsConfigPath()}):`];
      if (input.url !== undefined) lines.push(`  url: ${before.url} → ${after.url}`);
      if (input.user !== undefined) lines.push(`  user: ${before.user} → ${after.user}`);
      if (input.token !== undefined) lines.push(`  token: updated`);
      if (input.environment !== undefined) {
        lines.push(`  environment: ${before.environment} → ${after.environment}`);
        lines.push(`  job paths updated for ${after.environment}`);
      }
      return textResult(lines.join('\n'));
    },
  );
}
