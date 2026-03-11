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
    `Scale all ECS services tagged with ${getTagKey()} to desiredCount=1. Example: {confirm: true} or {tagValue: "my-tag", confirm: false}`,
    {
      tagValue: z.string().optional().describe(`Tag value to filter by (default: "${getTagValue()}")`),
      confirm: z.coerce.boolean().describe('true to execute, false to preview (boolean, default: false)'),
    },
    async (input) => {
      const tagValue = (input.tagValue as string) ?? getTagValue();
      const confirm = (input.confirm as boolean) ?? false;
      const lines: string[] = [`Finding services with tag ${getTagKey()}=${tagValue}...`];

      try {
        const arns = await getServiceArnsByTag(getTagKey(), tagValue);

        if (arns.length === 0) {
          return textResult(`No services found for tag ${getTagKey()}=${tagValue}`);
        }

        const services = arns.map(parseEcsArn).filter((s): s is NonNullable<typeof s> => s !== null);

        if (!confirm) {
          lines.push(`\nWould scale ${services.length} service(s) to desiredCount=1:`);
          for (const { cluster, service } of services) {
            lines.push(`  ${cluster}/${service}`);
          }
          lines.push('\nSet confirm=true to perform the scaling.');
          return textResult(lines.join('\n'));
        }

        lines.push(`\nScaling ${services.length} service(s) to desiredCount=1...`);
        const client = ecsClient();

        const results = await Promise.all(services.map(async ({ cluster, service }) => {
          try {
            const resp = await client.send(new UpdateServiceCommand({ cluster, service, desiredCount: 1 }));
            const svc = resp.service;
            return svc
              ? `  ${svc.serviceName}: desired=${svc.desiredCount}, running=${svc.runningCount}`
              : `  ${service}: update sent (no details returned)`;
          } catch (err: unknown) {
            return `  ${service}: ${formatAwsError(err)}`;
          }
        }));
        lines.push(...results);

        lines.push('\nBatch update completed.');
        return textResult(lines.join('\n'));
      } catch (error: unknown) {
        return errorResult(formatAwsError(error));
      }
    },
  );
}
