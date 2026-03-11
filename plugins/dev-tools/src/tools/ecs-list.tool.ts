import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DescribeServicesCommand } from '@aws-sdk/client-ecs';
import { ecsClient, getServiceArnsByTag, parseEcsArn, chunk, formatAwsError } from '../shared/aws-client.js';
import { getTagKey, getTagValue } from '../shared/config.js';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';

const DESCRIBE_CHUNK_SIZE = 10; // DescribeServicesCommand max per call

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

        const arns = await getServiceArnsByTag(getTagKey(), tagValue);
        if (arns.length === 0) {
          return textResult(`No services found for tag ${getTagKey()}=${tagValue}`);
        }

        // Group ARNs by cluster
        const clusterMap = new Map<string, string[]>();
        for (const arn of arns) {
          const parsed = parseEcsArn(arn);
          if (!parsed) continue;
          const existing = clusterMap.get(parsed.cluster) ?? [];
          existing.push(parsed.service);
          clusterMap.set(parsed.cluster, existing);
        }

        const lines: string[] = [`Fetching ECS services with tag ${getTagKey()}=${tagValue}...\n`];
        const client = ecsClient();

        for (const [cluster, services] of clusterMap) {
          lines.push(`Cluster: ${cluster}`);

          // Chunk to respect the 10-service limit per DescribeServicesCommand call
          const batches = chunk(services, DESCRIBE_CHUNK_SIZE);
          const allSvcs = [];
          for (const batch of batches) {
            try {
              const resp = await client.send(new DescribeServicesCommand({ cluster, services: batch }));
              allSvcs.push(...(resp.services ?? []));
            } catch (err: unknown) {
              lines.push(`  ${formatAwsError(err)}`);
            }
          }

          if (allSvcs.length === 0) {
            lines.push('  (no services returned)');
          } else {
            const header = '  Service                          Desired  Running  Status';
            const sep   = '  ' + '-'.repeat(60);
            lines.push(header, sep);
            for (const svc of allSvcs) {
              const name = (svc.serviceName ?? '').padEnd(32);
              const desired = String(svc.desiredCount ?? 0).padStart(7);
              const running = String(svc.runningCount ?? 0).padStart(8);
              lines.push(`  ${name} ${desired}  ${running}  ${svc.status ?? ''}`);
            }
          }
          lines.push('');
        }

        return textResult(lines.join('\n'));
      } catch (error: unknown) {
        return errorResult(formatAwsError(error));
      }
    },
  );
}
