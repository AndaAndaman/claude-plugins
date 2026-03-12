import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { UpdateServiceCommand } from '@aws-sdk/client-ecs';
import { ecsClient, formatAwsError } from '../shared/aws-client.js';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';

export function registerEcsUpdateServiceTool(server: McpServer): void {
  defineTool(
    server,
    'aws_ecs_update_service',
    'Update a single ECS service desired count. Preview with confirm=false (default), execute with confirm=true.',
    {
      cluster: z.string().describe('ECS cluster name'),
      service: z.string().describe('ECS service name'),
      desiredCount: z.coerce.number().describe('New desired count (integer >= 0)'),
      confirm: z.coerce.boolean().optional().describe('true to execute, false to preview (default: false)'),
    },
    async (input) => {
      const cluster = input.cluster as string;
      const service = input.service as string;
      const desiredCount = input.desiredCount as number;
      const confirm = (input.confirm as boolean) ?? false;

      if (!Number.isInteger(desiredCount) || desiredCount < 0) {
        return errorResult('desiredCount must be a non-negative integer.');
      }

      try {
        if (!confirm) {
          return textResult(
            `Would update ${service} in ${cluster} to desiredCount=${desiredCount}. Set confirm=true to execute.`,
          );
        }

        const client = ecsClient();
        const resp = await client.send(new UpdateServiceCommand({ cluster, service, desiredCount }));
        const svc = resp.service;

        if (!svc) {
          return errorResult('Update sent but no service details returned.');
        }

        return textResult(`${svc.serviceName}: desired=${svc.desiredCount} running=${svc.runningCount}`);
      } catch (error: unknown) {
        return errorResult(formatAwsError(error));
      }
    },
  );
}
