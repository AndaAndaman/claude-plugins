import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  ListClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
  UpdateServiceCommand,
  ListTasksCommand,
  DescribeTasksCommand,
  DescribeTaskDefinitionCommand,
} from '@aws-sdk/client-ecs';
import { GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { ecsClient, logsClient, getServiceArnsByTag, parseEcsArn, chunk, formatAwsError } from '../shared/aws-client.js';
import { getTagKey, getTagValue } from '../shared/config.js';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';

const DESCRIBE_CHUNK_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function listAllClusters(): Promise<string[]> {
  const client = ecsClient();
  const arns: string[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await client.send(new ListClustersCommand({ nextToken }));
    arns.push(...(resp.clusterArns ?? []));
    nextToken = resp.nextToken;
  } while (nextToken);
  return arns;
}

function clusterName(arn: string): string {
  return arn.split('/').pop() ?? arn;
}

function serviceName(arn: string): string {
  return arn.split('/').pop() ?? arn;
}

async function listServicesInCluster(cluster: string): Promise<string[]> {
  const client = ecsClient();
  const arns: string[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await client.send(new ListServicesCommand({ cluster, nextToken }));
    arns.push(...(resp.serviceArns ?? []));
    nextToken = resp.nextToken;
  } while (nextToken);
  return arns;
}

function requireParam(input: Record<string, unknown>, key: string, action: string): string {
  const val = input[key] as string | undefined;
  if (!val) throw new Error(`'${key}' is required for action '${action}'.`);
  return val;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function actionListClusters(): Promise<string> {
  const arns = await listAllClusters();
  if (arns.length === 0) return 'No ECS clusters found.';
  const lines = [`Found ${arns.length} cluster(s):\n`];
  for (const arn of arns) {
    lines.push(`  ${clusterName(arn)}`);
  }
  return lines.join('\n');
}

async function actionListServices(input: Record<string, unknown>): Promise<string> {
  const cluster = input.cluster as string | undefined;
  const tagVal = (input.tagValue as string) ?? getTagValue();

  if (cluster) {
    // List services in a specific cluster
    const arns = await listServicesInCluster(cluster);
    if (arns.length === 0) return `No services found in cluster ${cluster}.`;

    const client = ecsClient();
    const lines = [`Cluster: ${cluster} (${arns.length} services)\n`];
    const batches = chunk(arns.map(serviceName), DESCRIBE_CHUNK_SIZE);
    for (const batch of batches) {
      try {
        const resp = await client.send(new DescribeServicesCommand({ cluster, services: batch }));
        const header = '  Service                          Desired  Running  Status';
        const sep = '  ' + '-'.repeat(60);
        if (lines.length === 1) lines.push(header, sep);
        for (const svc of resp.services ?? []) {
          const name = (svc.serviceName ?? '').padEnd(32);
          const desired = String(svc.desiredCount ?? 0).padStart(7);
          const running = String(svc.runningCount ?? 0).padStart(8);
          lines.push(`  ${name} ${desired}  ${running}  ${svc.status ?? ''}`);
        }
      } catch (err: unknown) {
        lines.push(`  ${formatAwsError(err)}`);
      }
    }
    return lines.join('\n');
  }

  // Tag-based listing (original aws_ecs_list behavior)
  const arns = await getServiceArnsByTag(getTagKey(), tagVal);
  if (arns.length === 0) return `No services found for tag ${getTagKey()}=${tagVal}`;

  const clusterMap = new Map<string, string[]>();
  for (const arn of arns) {
    const parsed = parseEcsArn(arn);
    if (!parsed) continue;
    const existing = clusterMap.get(parsed.cluster) ?? [];
    existing.push(parsed.service);
    clusterMap.set(parsed.cluster, existing);
  }

  const lines: string[] = [`Services with tag ${getTagKey()}=${tagVal}:\n`];
  const client = ecsClient();
  for (const [cl, services] of clusterMap) {
    lines.push(`Cluster: ${cl}`);
    const batches = chunk(services, DESCRIBE_CHUNK_SIZE);
    const header = '  Service                          Desired  Running  Status';
    const sep = '  ' + '-'.repeat(60);
    lines.push(header, sep);
    for (const batch of batches) {
      try {
        const resp = await client.send(new DescribeServicesCommand({ cluster: cl, services: batch }));
        for (const svc of resp.services ?? []) {
          const name = (svc.serviceName ?? '').padEnd(32);
          const desired = String(svc.desiredCount ?? 0).padStart(7);
          const running = String(svc.runningCount ?? 0).padStart(8);
          lines.push(`  ${name} ${desired}  ${running}  ${svc.status ?? ''}`);
        }
      } catch (err: unknown) {
        lines.push(`  ${formatAwsError(err)}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function actionSearch(input: Record<string, unknown>): Promise<string> {
  const pattern = requireParam(input, 'pattern', 'search');
  const regex = new RegExp(pattern, 'i');

  const clusterArns = await listAllClusters();
  const matches: { cluster: string; service: string }[] = [];

  // Search services in all clusters in parallel
  const results = await Promise.all(
    clusterArns.map(async (arn) => {
      const cl = clusterName(arn);
      try {
        const serviceArns = await listServicesInCluster(cl);
        return serviceArns
          .map((sa) => ({ cluster: cl, service: serviceName(sa) }))
          .filter((s) => regex.test(s.service));
      } catch {
        return [];
      }
    }),
  );
  for (const r of results) matches.push(...r);

  if (matches.length === 0) return `No services matching "${pattern}" found across ${clusterArns.length} clusters.`;

  const lines = [`Found ${matches.length} service(s) matching "${pattern}":\n`];
  for (const m of matches) {
    lines.push(`  ${m.cluster} / ${m.service}`);
  }
  return lines.join('\n');
}

async function actionDescribe(input: Record<string, unknown>): Promise<string> {
  const cluster = requireParam(input, 'cluster', 'describe');
  const service = requireParam(input, 'service', 'describe');

  const client = ecsClient();
  const resp = await client.send(new DescribeServicesCommand({ cluster, services: [service] }));
  const svc = resp.services?.[0];
  if (!svc) return `Service ${service} not found in cluster ${cluster}.`;

  const lines = [
    `Service: ${svc.serviceName}`,
    `Status: ${svc.status}`,
    `Desired: ${svc.desiredCount}  Running: ${svc.runningCount}  Pending: ${svc.pendingCount}`,
    `Launch type: ${svc.launchType ?? 'N/A'}`,
    `Task definition: ${svc.taskDefinition?.split('/').pop() ?? 'N/A'}`,
    '',
    'Deployments:',
  ];

  for (const dep of svc.deployments ?? []) {
    const taskDef = dep.taskDefinition?.split('/').pop() ?? '?';
    lines.push(
      `  ${dep.status} | desired=${dep.desiredCount} running=${dep.runningCount} pending=${dep.pendingCount} rollout=${dep.rolloutState ?? '?'} | task=${taskDef}`,
    );
  }

  if (svc.loadBalancers && svc.loadBalancers.length > 0) {
    lines.push('', 'Load balancers:');
    for (const lb of svc.loadBalancers) {
      lines.push(`  ${lb.targetGroupArn?.split('/').slice(-2).join('/') ?? 'N/A'} → container=${lb.containerName}:${lb.containerPort}`);
    }
  }

  return lines.join('\n');
}

async function actionScale(input: Record<string, unknown>): Promise<string> {
  const tagVal = (input.tagValue as string) ?? getTagValue();
  const desiredCount = (input.desiredCount as number) ?? 1;
  const confirm = (input.confirm as boolean) ?? false;

  if (!Number.isInteger(desiredCount) || desiredCount < 0) {
    throw new Error('desiredCount must be a non-negative integer.');
  }

  const arns = await getServiceArnsByTag(getTagKey(), tagVal);
  if (arns.length === 0) return `No services found for tag ${getTagKey()}=${tagVal}`;

  const services = arns.map(parseEcsArn).filter((s): s is NonNullable<typeof s> => s !== null);

  if (!confirm) {
    const lines = [`Would scale ${services.length} service(s) to desiredCount=${desiredCount}:`];
    for (const { cluster, service } of services) {
      lines.push(`  ${cluster}/${service}`);
    }
    lines.push('\nSet confirm=true to execute.');
    return lines.join('\n');
  }

  const client = ecsClient();
  const results = await Promise.all(
    services.map(async ({ cluster, service }) => {
      try {
        const resp = await client.send(new UpdateServiceCommand({ cluster, service, desiredCount }));
        const svc = resp.service;
        return svc
          ? `  ${svc.serviceName}: desired=${svc.desiredCount} running=${svc.runningCount}`
          : `  ${service}: update sent`;
      } catch (err: unknown) {
        return `  ${service}: ${formatAwsError(err)}`;
      }
    }),
  );
  return `Scaled ${services.length} service(s) to desiredCount=${desiredCount}\n${results.join('\n')}`;
}

async function actionUpdate(input: Record<string, unknown>): Promise<string> {
  const cluster = requireParam(input, 'cluster', 'update');
  const service = requireParam(input, 'service', 'update');
  const desiredCount = input.desiredCount as number;
  const confirm = (input.confirm as boolean) ?? false;

  if (desiredCount == null || !Number.isInteger(desiredCount) || desiredCount < 0) {
    throw new Error('desiredCount must be a non-negative integer.');
  }

  if (!confirm) {
    return `Would update ${service} in ${cluster} to desiredCount=${desiredCount}. Set confirm=true to execute.`;
  }

  const client = ecsClient();
  const resp = await client.send(new UpdateServiceCommand({ cluster, service, desiredCount }));
  const svc = resp.service;
  if (!svc) throw new Error('Update sent but no service details returned.');
  return `${svc.serviceName}: desired=${svc.desiredCount} running=${svc.runningCount}`;
}

async function actionRestart(input: Record<string, unknown>): Promise<string> {
  const cluster = requireParam(input, 'cluster', 'restart');
  const service = requireParam(input, 'service', 'restart');
  const confirm = (input.confirm as boolean) ?? false;

  if (!confirm) {
    return `Would force new deployment for ${service} in ${cluster}. Set confirm=true to execute.`;
  }

  const client = ecsClient();
  const resp = await client.send(new UpdateServiceCommand({ cluster, service, forceNewDeployment: true }));
  const svc = resp.service;
  if (!svc) throw new Error('Restart sent but no service details returned.');
  return `Restarted ${svc.serviceName}: desired=${svc.desiredCount} running=${svc.runningCount}\nNew deployment triggered — use action=wait to monitor.`;
}

async function actionEvents(input: Record<string, unknown>): Promise<string> {
  const cluster = requireParam(input, 'cluster', 'events');
  const service = requireParam(input, 'service', 'events');
  const count = Math.min((input.count as number) ?? 10, 100);

  const client = ecsClient();
  const resp = await client.send(new DescribeServicesCommand({ cluster, services: [service] }));
  const svc = resp.services?.[0];
  if (!svc) return `Service ${service} not found in cluster ${cluster}.`;

  const events = (svc.events ?? []).slice(0, count);
  if (events.length === 0) return `No events for ${service}.`;

  const lines = [`Last ${events.length} events for ${service}:\n`];
  for (const ev of events) {
    const ts = ev.createdAt ? ev.createdAt.toISOString().replace('T', ' ').slice(0, 19) : '?';
    lines.push(`  [${ts}] ${ev.message ?? ''}`);
  }
  return lines.join('\n');
}

async function actionTasks(input: Record<string, unknown>): Promise<string> {
  const cluster = requireParam(input, 'cluster', 'tasks');
  const service = requireParam(input, 'service', 'tasks');

  const client = ecsClient();
  const listResp = await client.send(new ListTasksCommand({ cluster, serviceName: service }));
  const taskArns = listResp.taskArns ?? [];
  if (taskArns.length === 0) return `No running tasks for ${service} in ${cluster}.`;

  const descResp = await client.send(new DescribeTasksCommand({ cluster, tasks: taskArns }));
  const tasks = descResp.tasks ?? [];

  const lines = [`${tasks.length} task(s) for ${service}:\n`];
  for (const task of tasks) {
    const taskId = task.taskArn?.split('/').pop() ?? '?';
    const status = task.lastStatus ?? '?';
    const health = task.healthStatus ?? 'N/A';
    const started = task.startedAt ? task.startedAt.toISOString().replace('T', ' ').slice(0, 19) : 'pending';
    const taskDef = task.taskDefinitionArn?.split('/').pop() ?? '?';

    // Extract private IP from attachments
    let ip = 'N/A';
    for (const att of task.attachments ?? []) {
      const ipDetail = att.details?.find((d) => d.name === 'privateIPv4Address');
      if (ipDetail?.value) { ip = ipDetail.value; break; }
    }

    // Container statuses
    const containers = (task.containers ?? [])
      .map((c) => `${c.name}:${c.lastStatus}`)
      .join(', ');

    lines.push(`  ${taskId}`);
    lines.push(`    Status: ${status}  Health: ${health}  IP: ${ip}`);
    lines.push(`    Started: ${started}  TaskDef: ${taskDef}`);
    if (containers) lines.push(`    Containers: ${containers}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function actionLogs(input: Record<string, unknown>): Promise<string> {
  const cluster = requireParam(input, 'cluster', 'logs');
  const service = requireParam(input, 'service', 'logs');
  const count = Math.min((input.count as number) ?? 50, 200);
  const taskId = input.task as string | undefined;

  const client = ecsClient();

  // Find task ARN
  let taskArn: string;
  if (taskId) {
    taskArn = taskId.includes(':') ? taskId : `arn:aws:ecs:ap-southeast-1:*:task/${cluster}/${taskId}`;
    // If short ID, list tasks and match
    if (!taskId.includes(':')) {
      const listResp = await client.send(new ListTasksCommand({ cluster, serviceName: service }));
      const match = (listResp.taskArns ?? []).find((a) => a.includes(taskId));
      if (!match) return `Task ${taskId} not found in ${service}.`;
      taskArn = match;
    }
  } else {
    // Get latest task
    const listResp = await client.send(new ListTasksCommand({ cluster, serviceName: service }));
    const arns = listResp.taskArns ?? [];
    if (arns.length === 0) return `No running tasks for ${service} — no logs available.`;
    taskArn = arns[0];
  }

  // Describe task to get task definition
  const descResp = await client.send(new DescribeTasksCommand({ cluster, tasks: [taskArn] }));
  const task = descResp.tasks?.[0];
  if (!task) return 'Task not found.';

  // Get task definition for log configuration
  const tdResp = await client.send(new DescribeTaskDefinitionCommand({
    taskDefinition: task.taskDefinitionArn!,
  }));
  const containerDef = tdResp.taskDefinition?.containerDefinitions?.[0];
  const logConfig = containerDef?.logConfiguration;
  if (!logConfig || logConfig.logDriver !== 'awslogs') {
    return `Log driver is ${logConfig?.logDriver ?? 'none'} — only awslogs is supported.`;
  }

  const logGroup = logConfig.options?.['awslogs-group'];
  const streamPrefix = logConfig.options?.['awslogs-stream-prefix'];
  const containerName = containerDef.name;
  const shortTaskId = taskArn.split('/').pop();

  if (!logGroup || !streamPrefix || !containerName || !shortTaskId) {
    return 'Could not determine log stream parameters from task definition.';
  }

  const logStream = `${streamPrefix}/${containerName}/${shortTaskId}`;

  try {
    const cwClient = logsClient();
    const logResp = await cwClient.send(new GetLogEventsCommand({
      logGroupName: logGroup,
      logStreamName: logStream,
      limit: count,
      startFromHead: false,
    }));

    const events = logResp.events ?? [];
    if (events.length === 0) return `No log events in ${logGroup}/${logStream}.`;

    const lines = [`Logs for ${service} (${events.length} events):\n`];
    for (const ev of events) {
      const ts = ev.timestamp ? new Date(ev.timestamp).toISOString().replace('T', ' ').slice(0, 19) : '';
      lines.push(`[${ts}] ${ev.message?.trimEnd() ?? ''}`);
    }
    return lines.join('\n');
  } catch (err: unknown) {
    return `Log fetch failed: ${formatAwsError(err)}\nLog group: ${logGroup}\nLog stream: ${logStream}`;
  }
}

async function actionWait(input: Record<string, unknown>): Promise<string> {
  const cluster = requireParam(input, 'cluster', 'wait');
  const service = requireParam(input, 'service', 'wait');
  const timeoutSec = Math.min((input.timeout as number) ?? 300, 600);

  const client = ecsClient();
  const startTime = Date.now();
  const deadline = startTime + timeoutSec * 1000;
  let lastStatus = '';

  while (Date.now() < deadline) {
    const resp = await client.send(new DescribeServicesCommand({ cluster, services: [service] }));
    const svc = resp.services?.[0];
    if (!svc) return `Service ${service} not found in cluster ${cluster}.`;

    const deployments = svc.deployments ?? [];
    const primary = deployments.find((d) => d.status === 'PRIMARY');

    if (primary?.rolloutState === 'COMPLETED' && deployments.length === 1) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      return `Service ${service} is stable (${elapsed}s elapsed).\nDesired: ${svc.desiredCount}  Running: ${svc.runningCount}`;
    }

    const statusLine = deployments
      .map((d) => `${d.status}: desired=${d.desiredCount} running=${d.runningCount} rollout=${d.rolloutState ?? '?'}`)
      .join(' | ');

    if (statusLine !== lastStatus) {
      lastStatus = statusLine;
    }

    // Check for failed deployment
    if (primary?.rolloutState === 'FAILED') {
      return `Deployment FAILED for ${service}.\n${statusLine}`;
    }

    // Poll every 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  return `Timed out after ${timeoutSec}s. Last status: ${lastStatus}`;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerEcsTool(server: McpServer): void {
  defineTool(
    server,
    'aws_ecs',
    'ECS management: list clusters, find services, describe deployments, scale, restart, view events/tasks/logs, wait for stable.',
    {
      action: z.enum([
        'list_clusters', 'list_services', 'search', 'describe',
        'scale', 'update', 'restart',
        'events', 'tasks', 'logs', 'wait',
      ]).describe('Action to perform'),
      cluster: z.string().optional().describe('ECS cluster name'),
      service: z.string().optional().describe('ECS service name'),
      pattern: z.string().optional().describe('Search pattern (regex, for search action)'),
      tagValue: z.string().optional().describe('Tag value filter (for list_services, scale)'),
      desiredCount: z.coerce.number().optional().describe('Target desired count (for update, scale)'),
      confirm: z.coerce.boolean().optional().describe('true to execute, false to preview (for update, scale, restart)'),
      count: z.coerce.number().optional().describe('Number of items (events default 10, logs default 50)'),
      task: z.string().optional().describe('Task ID (for logs — defaults to latest)'),
      timeout: z.coerce.number().optional().describe('Timeout in seconds (for wait, default 300, max 600)'),
    },
    async (input) => {
      try {
        const action = input.action as string;
        switch (action) {
          case 'list_clusters': return textResult(await actionListClusters());
          case 'list_services': return textResult(await actionListServices(input));
          case 'search': return textResult(await actionSearch(input));
          case 'describe': return textResult(await actionDescribe(input));
          case 'scale': return textResult(await actionScale(input));
          case 'update': return textResult(await actionUpdate(input));
          case 'restart': return textResult(await actionRestart(input));
          case 'events': return textResult(await actionEvents(input));
          case 'tasks': return textResult(await actionTasks(input));
          case 'logs': return textResult(await actionLogs(input));
          case 'wait': return textResult(await actionWait(input));
          default: return errorResult(`Unknown action: ${action}`);
        }
      } catch (error: unknown) {
        return errorResult(formatAwsError(error));
      }
    },
  );
}
