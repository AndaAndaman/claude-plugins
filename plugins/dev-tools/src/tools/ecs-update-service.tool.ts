import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runAwsWithProfile } from '../shared/aws.js';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';

export function registerEcsUpdateServiceTool(server: McpServer): void {
  defineTool(
    server,
    'aws_ecs_update_service',
    'Update a single ECS service desired count. Use confirm=false to preview, confirm=true to execute.',
    {
      cluster: z.string().describe('ECS cluster name'),
      service: z.string().describe('ECS service name'),
      desiredCount: z.number().describe('New desired count for the service (integer >= 0)'),
      confirm: z.boolean().describe('Set true to actually perform the update (default: false = preview only)'),
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

        const result = runAwsWithProfile([
          'ecs', 'update-service',
          '--cluster', cluster,
          '--service', service,
          '--desired-count', String(desiredCount),
          '--output', 'table',
          '--query', 'service.[serviceName,desiredCount,runningCount]',
        ]);

        if (result.status !== 0) {
          return errorResult(`Error: ${result.stderr}`);
        }

        lines.push(result.stdout.trim());
        return textResult(lines.join('\n'));
      } catch (error: unknown) {
        return errorResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );
}
