import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult } from '../shared/mcp-helpers.js';
import { loadJenkinsConfig, saveJenkinsConfig, getJenkinsConfigPath } from '../shared/jenkins.js';

export function registerJenkinsEditConfigTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_edit_config',
    'View or edit Jenkins config file. Show full config, set/remove target default overrides, or reset all overrides.',
    {
      action: z.enum(['show', 'set', 'remove', 'reset']).describe(
        'show=view full config, set=set target default override, remove=remove a target override, reset=clear all target overrides'
      ),
      target: z.string().optional().describe('Target name for set/remove (e.g. "api", "ui")'),
      key: z.string().optional().describe('Param key for set/remove (e.g. "COMMIT_HASH")'),
      value: z.string().optional().describe('Param value for set'),
    },
    async (input) => {
      const config = loadJenkinsConfig();

      if (input.action === 'show') {
        const tok = config.token ? config.token.slice(0, 6) + '...' : '<not set>';
        const lines = [
          `Config: ${getJenkinsConfigPath()}`,
          '',
          `url: ${config.url}`,
          `user: ${config.user}`,
          `token: ${tok}`,
          `environment: ${config.environment}`,
        ];
        const td = config.targetDefaults;
        if (td && Object.keys(td).length > 0) {
          lines.push('', 'Target overrides:');
          for (const [t, o] of Object.entries(td)) {
            for (const [k, v] of Object.entries(o)) {
              lines.push(`  ${t}.${k} = ${v}`);
            }
          }
        } else {
          lines.push('', 'Target overrides: (none)');
        }
        return textResult(lines.join('\n'));
      }

      if (input.action === 'set') {
        if (!input.target || !input.key || input.value === undefined) {
          return textResult('Error: set requires target, key, and value.');
        }
        const td = config.targetDefaults || {};
        td[input.target] = { ...(td[input.target] || {}), [input.key]: input.value };
        saveJenkinsConfig({ targetDefaults: td });
        return textResult(`Set ${input.target}.${input.key} = ${input.value}`);
      }

      if (input.action === 'remove') {
        if (!input.target) {
          return textResult('Error: remove requires target. Optionally key to remove a single param.');
        }
        const td = config.targetDefaults || {};
        if (!td[input.target]) {
          return textResult(`No overrides for ${input.target}.`);
        }
        if (input.key) {
          delete td[input.target][input.key];
          if (Object.keys(td[input.target]).length === 0) delete td[input.target];
          saveJenkinsConfig({ targetDefaults: td });
          return textResult(`Removed ${input.target}.${input.key}`);
        }
        delete td[input.target];
        saveJenkinsConfig({ targetDefaults: td });
        return textResult(`Removed all overrides for ${input.target}.`);
      }

      if (input.action === 'reset') {
        saveJenkinsConfig({ targetDefaults: {} });
        return textResult('All target overrides cleared.');
      }

      return textResult('Unknown action.');
    },
  );
}
