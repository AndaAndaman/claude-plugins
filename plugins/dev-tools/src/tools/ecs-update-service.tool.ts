import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { UpdateServiceCommand } from '@aws-sdk/client-ecs';
import { ecsClient, formatAwsError } from '../shared/aws-client.js';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';

export function registerEcsUpdateServiceTool(server: McpServer): void {
  defineTool(
    server,
    'aws_ecs_update_service',
    'Update a single ECS service desired count. Example: {cluster: "my-cluster", service: "my-svc", desiredCount: 1, confirm: true}',
    {
      cluster: z.string().describe('ECS cluster name'),
      service: z.string().describe('ECS service name'),
      desiredCount: z.coerce.number().describe('New desired count (number, integer >= 0)'),
      confirm: z.coerce.boolean().describe('true to execute, false to preview (boolean, default: false)'),
    },
    async (input) => {
      const cluster = input.cluster as string;
      const service = input.service as string;
      const desiredCount = input.desiredCount as number;
      const confirm = (input.confirm as boolean) ?? false;

      try {
        if (!confirm) {
          return textResult(
            `Would update service ${service} in cluster ${cluster} to desiredCount=${desiredCount}.\n\nSet confirm=true to perform the update.`,
          );
        }

        const lines: string[] = [`Updating service ${service} in cluster ${cluster} to desired count ${desiredCount}`];

        const client = ecsClient();
        const updateResponse = await client.send(new UpdateServiceCommand({
          cluster,
          service,
          desiredCount,
        }));

        const svc = updateResponse.service;
        if (!svc) {
          return errorResult('Update sent but no service details returned.');
        }

        lines.push(`  ${svc.serviceName}: desired=${svc.desiredCount}, running=${svc.runningCount}`);
        return textResult(lines.join('\n'));
      } catch (error: unknown) {
        return errorResult(formatAwsError(error));
      }
    },
  );
}
