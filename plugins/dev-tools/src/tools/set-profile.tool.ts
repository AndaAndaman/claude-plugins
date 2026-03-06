import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getConfig, setProfile, setTagKey, setTagValue } from '../shared/config.js';
import { defineTool, textResult } from '../shared/mcp-helpers.js';

export function registerConfigureTool(server: McpServer): void {
  defineTool(
    server,
    'aws_configure',
    'View or update AWS settings (profile, tagKey, tagValue). Persists to ~/.config/dev-tools/config.json.',
    {
      profile: z.string().optional().describe('AWS CLI profile name'),
      tagKey: z.string().optional().describe('ECS service tag key for filtering'),
      tagValue: z.string().optional().describe('ECS service tag value for filtering'),
    },
    async (input) => {
      const before = getConfig();
      let changed = false;

      if (input.profile !== undefined) { setProfile(input.profile as string); changed = true; }
      if (input.tagKey !== undefined) { setTagKey(input.tagKey as string); changed = true; }
      if (input.tagValue !== undefined) { setTagValue(input.tagValue as string); changed = true; }

      const c = getConfig();

      if (!changed) {
        return textResult(`AWS: profile=${c.profile} tag=${c.tagKey}:${c.tagValue}`);
      }

      const changes: string[] = [];
      if (input.profile !== undefined) changes.push(`profile: ${before.profile} → ${c.profile}`);
      if (input.tagKey !== undefined) changes.push(`tagKey: ${before.tagKey} → ${c.tagKey}`);
      if (input.tagValue !== undefined) changes.push(`tagValue: ${before.tagValue} → ${c.tagValue}`);
      return textResult(`Updated: ${changes.join(', ')}`);
    },
  );
}
