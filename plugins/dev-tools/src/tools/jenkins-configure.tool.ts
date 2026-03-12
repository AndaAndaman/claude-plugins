import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult } from '../shared/mcp-helpers.js';
import { loadJenkinsConfig, saveJenkinsConfig } from '../shared/jenkins.js';

export function registerJenkinsConfigureTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_configure',
    'View or update Jenkins settings (url, user, token, environment). Persists to ~/.config/dev-tools/jenkins.json. Use jenkins_edit_config for target default overrides.',
    {
      url: z.string().optional().describe('Jenkins base URL'),
      user: z.string().optional().describe('Jenkins API username'),
      token: z.string().optional().describe('Jenkins API token'),
      environment: z.enum(['staging', 'preprod']).optional().describe('Switches job paths automatically'),
    },
    async (input) => {
      const before = loadJenkinsConfig();
      let changed = false;

      const updates: Partial<Parameters<typeof saveJenkinsConfig>[0]> = {};
      if (input.environment !== undefined) { updates.environment = input.environment as 'staging' | 'preprod'; changed = true; }
      if (input.url !== undefined) { updates.url = input.url as string; changed = true; }
      if (input.user !== undefined) { updates.user = input.user as string; changed = true; }
      if (input.token !== undefined) { updates.token = input.token as string; changed = true; }

      if (changed) saveJenkinsConfig(updates);

      const c = loadJenkinsConfig();
      const tok = c.token ? c.token.slice(0, 6) + '...' : '<not set>';

      if (!changed) {
        return textResult(`Jenkins [${c.environment}] url=${c.url} user=${c.user} token=${tok}`);
      }

      const changes: string[] = [];
      if (input.url !== undefined) changes.push(`url: ${before.url} → ${c.url}`);
      if (input.user !== undefined) changes.push(`user: ${before.user} → ${c.user}`);
      if (input.token !== undefined) changes.push('token: updated');
      if (input.environment !== undefined) changes.push(`env: ${before.environment} → ${c.environment}`);
      return textResult(`Updated: ${changes.join(', ')}`);
    },
  );
}
