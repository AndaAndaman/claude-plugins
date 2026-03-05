import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runAwsWithProfile } from '../shared/aws.js';
import { getProfile, getTagKey, getTagValue } from '../shared/config.js';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';

export function registerEcsScaleTool(server: McpServer): void {
  defineTool(
    server,
    'aws_ecs_scale',
    `Scale all ECS services tagged with ${getTagKey()} to desiredCount=1. Use confirm=false to preview, confirm=true to execute.`,
    {
      tagValue: z.string().optional().describe(`Tag value to filter by (default: "${getTagValue()}")`),
      confirm: z.boolean().describe('Set true to actually perform the scaling (default: false = preview only)'),
    },
    async (input) => {
      const tagValue = (input.tagValue as string) ?? getTagValue();
      const confirm = (input.confirm as boolean) ?? false;
      const lines: string[] = [`Finding services with tag ${getTagKey()}=${tagValue}...`];

      try {
        const arnResult = runAwsWithProfile([
          'resourcegroupstaggingapi', 'get-resources',
          '--resource-type-filters', 'ecs:service',
          '--tag-filters', `Key=${getTagKey()},Values=${tagValue}`,
          '--query', 'ResourceTagMappingList[].ResourceARN',
          '--output', 'text',
        ]);

        if (arnResult.status !== 0) {
          return errorResult(`Error fetching ARNs: ${arnResult.stderr}`);
        }

        const arns = arnResult.stdout.trim().split(/\s+/).filter(Boolean);
        if (arns.length === 0) {
          return textResult(`No services found for tag ${getTagKey()}=${tagValue}`);
        }

        const services: Array<{ cluster: string; service: string }> = [];
        for (const arn of arns) {
          const parts = arn.split('/');
          const cluster = parts[1];
          const service = parts[2];
          if (cluster && service) services.push({ cluster, service });
        }

        if (!confirm) {
          lines.push(`\nWould scale ${services.length} service(s) to desiredCount=1:`);
          for (const { cluster, service } of services) {
            lines.push(`  ${cluster}/${service}`);
          }
          lines.push('\nSet confirm=true to perform the scaling.');
          return textResult(lines.join('\n'));
        }

        lines.push(`\nScaling ${services.length} service(s) to desiredCount=1...`);
        for (const { cluster, service } of services) {
          lines.push(`\nScaling up service ${service} in cluster ${cluster} to desired count 1...`);
          const updateResult = runAwsWithProfile([
            'ecs', 'update-service',
            '--cluster', cluster,
            '--service', service,
            '--desired-count', '1',
            '--output', 'table',
            '--query', 'service.[serviceName,desiredCount,runningCount]',
          ]);
          lines.push(updateResult.status !== 0 ? `  Error: ${updateResult.stderr}` : updateResult.stdout.trim());
        }

        lines.push('\nBatch update completed.');
        return textResult(lines.join('\n'));
      } catch (error: unknown) {
        return errorResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );
}
