import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { UpdateServiceCommand } from '@aws-sdk/client-ecs';
import { ecsClient, getServiceArnsByTag, parseEcsArn, formatAwsError } from '../shared/aws-client.js';
import { getTagKey, getTagValue } from '../shared/config.js';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';

export function registerEcsScaleTool(server: McpServer): void {
  defineTool(
    server,
    'aws_ecs_scale',
    'Scale all ECS services matching a tag to a desired count. Preview with confirm=false (default), execute with confirm=true.',
    {
      desiredCount: z.coerce.number().optional().describe('Target desired count (integer >= 0, default: 1)'),
      tagValue: z.string().optional().describe('Tag value to filter by (uses configured default if omitted)'),
      confirm: z.coerce.boolean().optional().describe('true to execute, false to preview (default: false)'),
    },
    async (input) => {
      const tagKey = getTagKey();
      const tagValue = (input.tagValue as string) ?? getTagValue();
      const desiredCount = (input.desiredCount as number) ?? 1;
      const confirm = (input.confirm as boolean) ?? false;

      if (!Number.isInteger(desiredCount) || desiredCount < 0) {
        return errorResult('desiredCount must be a non-negative integer.');
      }

      try {
        const arns = await getServiceArnsByTag(tagKey, tagValue);
        if (arns.length === 0) {
          return textResult(`No services found for tag ${tagKey}=${tagValue}`);
        }

        const services = arns.map(parseEcsArn).filter((s): s is NonNullable<typeof s> => s !== null);

        if (!confirm) {
          const lines = [`Would scale ${services.length} service(s) to desiredCount=${desiredCount}:`];
          for (const { cluster, service } of services) {
            lines.push(`  ${cluster}/${service}`);
          }
          lines.push('\nSet confirm=true to execute.');
          return textResult(lines.join('\n'));
        }

        const client = ecsClient();
        const results = await Promise.all(services.map(async ({ cluster, service }) => {
          try {
            const resp = await client.send(new UpdateServiceCommand({ cluster, service, desiredCount }));
            const svc = resp.service;
            return svc
              ? `  ${svc.serviceName}: desired=${svc.desiredCount} running=${svc.runningCount}`
              : `  ${service}: update sent`;
          } catch (err: unknown) {
            return `  ${service}: ${formatAwsError(err)}`;
          }
        }));

        return textResult(`Scaled ${services.length} service(s) to desiredCount=${desiredCount}\n${results.join('\n')}`);
      } catch (error: unknown) {
        return errorResult(formatAwsError(error));
      }
    },
  );
}
