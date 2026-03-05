import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getConfig, getConfigPath, setProfile, setTagKey, setTagValue } from '../shared/config.js';
import { defineTool, textResult } from '../shared/mcp-helpers.js';

export function registerConfigureTool(server: McpServer): void {
  defineTool(
    server,
    'aws_configure',
    'Configure AWS settings used by all tools. Settings persist to ~/.config/dev-tools/config.json. Call without arguments to see current config.',
    {
      profile: z.string().optional().describe('AWS CLI profile name (default: basic_profile)'),
      tagKey: z.string().optional().describe('ECS service tag key for filtering (default: acc-sandbox)'),
      tagValue: z.string().optional().describe('ECS service tag value for filtering (default: core,profile,report,doc,ui,my)'),
    },
    async (input) => {
      const before = getConfig();
      let changed = false;

      if (input.profile !== undefined) {
        setProfile(input.profile as string);
        changed = true;
      }
      if (input.tagKey !== undefined) {
        setTagKey(input.tagKey as string);
        changed = true;
      }
      if (input.tagValue !== undefined) {
        setTagValue(input.tagValue as string);
        changed = true;
      }

      const after = getConfig();

      if (!changed) {
        return textResult([
          `Current AWS configuration (${getConfigPath()}):`,
          `  profile:  ${after.profile}`,
          `  tagKey:   ${after.tagKey}`,
          `  tagValue: ${after.tagValue}`,
        ].join('\n'));
      }

      const lines = [`AWS configuration updated (saved to ${getConfigPath()}):`];
      if (input.profile !== undefined) lines.push(`  profile:  ${before.profile} → ${after.profile}`);
      if (input.tagKey !== undefined) lines.push(`  tagKey:   ${before.tagKey} → ${after.tagKey}`);
      if (input.tagValue !== undefined) lines.push(`  tagValue: ${before.tagValue} → ${after.tagValue}`);

      return textResult(lines.join('\n'));
    },
  );
}
