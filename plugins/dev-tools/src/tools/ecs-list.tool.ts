import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runAwsWithProfile } from '../shared/aws.js';
import { getTagKey, getTagValue } from '../shared/config.js';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';

export function registerEcsListTool(server: McpServer): void {
  defineTool(
    server,
    'aws_ecs_list',
    'Lists ECS services filtered by tag key/value, grouped by cluster with service status.',
    {
      tagValue: z.string().optional().describe(`Tag value to filter by (default: "${getTagValue()}")`),
    },
    async (input) => {
      try {
        const tagValue = (input.tagValue as string) ?? getTagValue();

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

        const clusterMap = new Map<string, string[]>();
        for (const arn of arns) {
          const parts = arn.split('/');
          const cluster = parts[1];
          const service = parts[2];
          if (!cluster || !service) continue;
          const existing = clusterMap.get(cluster) ?? [];
          existing.push(service);
          clusterMap.set(cluster, existing);
        }

        const lines: string[] = [`Fetching ECS services with tag ${getTagKey()}=${tagValue}...\n`];
        for (const [cluster, services] of clusterMap) {
          lines.push(`Cluster: ${cluster}`);
          const descResult = runAwsWithProfile([
            'ecs', 'describe-services',
            '--cluster', cluster,
            '--services', ...services,
            '--query', 'services[].{Service:serviceName,Desired:desiredCount,Running:runningCount,Status:status}',
            '--output', 'table',
          ]);
          lines.push(descResult.status !== 0 ? `  Error: ${descResult.stderr}` : descResult.stdout);
        }

        return textResult(lines.join('\n'));
      } catch (error: unknown) {
        return errorResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );
}
