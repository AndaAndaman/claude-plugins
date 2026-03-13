import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import {
  BUILD_TARGETS,
  triggerBuild,
  resolveQueue,
  getBuildStatus,
  loadJenkinsConfig,
  getEffectiveDefaults,
  setLastBuild,
} from '../shared/jenkins.js';
import { getEndpoints } from '../shared/healthcheck.js';

/**
 * jenkins_build_verify: Trigger build, poll until complete, then run post-build verification.
 * Replaces 5-6 sequential MCP calls (jenkins_build + jenkins_status + healthcheck + ecs) with 1.
 */

async function fetchHealthcheck(
  url: string,
  method: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<{ status: number; ok: boolean; durationMs: number; body?: string; error?: string }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, signal: controller.signal, headers: headers || {} });
    const body = await res.text().catch(() => '');
    return { status: res.status, ok: res.ok, durationMs: Date.now() - start, body };
  } catch (err: unknown) {
    const msg = controller.signal.aborted
      ? `Timeout after ${timeoutMs}ms`
      : (err instanceof Error ? err.message : String(err));
    return { status: 0, ok: false, durationMs: Date.now() - start, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export function registerJenkinsBuildVerifyTool(server: McpServer): void {
  defineTool(
    server,
    'jenkins_build_verify',
    `Trigger Jenkins build, wait for completion, and run post-build healthchecks — all in one call. Targets: ${Object.keys(BUILD_TARGETS).join(', ')}. Example: {target: "ui", verify: true}`,
    {
      target: z.string().describe(`Build target: ${Object.keys(BUILD_TARGETS).join(', ')}`),
      params: z.string().optional().describe('JSON overrides, e.g. {"COMMIT_HASH":"main"}'),
      verify: z.boolean().optional().describe('Run healthchecks after build succeeds (default: true)'),
      poll_timeout: z.coerce.number().optional().describe('Max seconds to wait for build completion (default: 600)'),
      console_lines: z.coerce.number().optional().describe('Console lines to show (default: 30)'),
    },
    async (input) => {
      const target = input.target as string;
      const verify = (input.verify as boolean) ?? true;
      const pollTimeout = ((input.poll_timeout as number) ?? 600) * 1000;
      const consoleLines = (input.console_lines as number) ?? 30;

      if (!BUILD_TARGETS[target]) {
        return errorResult(`Unknown target: ${target}. Available: ${Object.keys(BUILD_TARGETS).join(', ')}`);
      }

      let params: Record<string, string> = {};
      if (input.params) {
        try {
          params = JSON.parse(input.params as string);
        } catch {
          return errorResult('Invalid params JSON.');
        }
      }

      const bt = BUILD_TARGETS[target];
      const config = loadJenkinsConfig();
      const merged = { ...getEffectiveDefaults(target, bt, config), ...params };

      const lines: string[] = [
        `=== BUILD: [${config.environment}] ${target} ===`,
        '',
      ];

      for (const [k, v] of Object.entries(merged)) {
        const isOverride = k in params;
        lines.push(`  ${k}: ${v || '""'}${isOverride ? ' (override)' : ''}`);
      }
      lines.push('');

      // --- Step 1: Trigger build ---
      const triggerResult = triggerBuild(target, params);
      if (!triggerResult.success) {
        return errorResult(`${lines.join('\n')}\nFailed: ${triggerResult.error}`);
      }

      lines.push(`Queued: ${triggerResult.queueUrl}`);
      setLastBuild({ target, queueUrl: triggerResult.queueUrl!, timestamp: Date.now() });

      // --- Step 2: Resolve queue → build URL ---
      lines.push('Waiting for build to start...');
      const resolved = await resolveQueue(triggerResult.queueUrl!, 90000);

      if (resolved.cancelled) {
        lines.push('Build was cancelled in queue.');
        return textResult(lines.join('\n'));
      }
      if (!resolved.buildUrl) {
        lines.push(`Queue not resolved: ${resolved.reason}`);
        return textResult(lines.join('\n'));
      }

      const buildUrl = resolved.buildUrl;
      lines.push(`Build started: ${buildUrl}`);

      // Update last build state
      const initialStatus = getBuildStatus(buildUrl, 5);
      setLastBuild({
        target,
        queueUrl: triggerResult.queueUrl!,
        buildUrl,
        buildNumber: initialStatus.number ?? undefined,
        timestamp: Date.now(),
      });

      lines.push(`Build #${initialStatus.number || '?'} in progress...`);
      lines.push('');

      // --- Step 3: Poll until build completes ---
      const pollStart = Date.now();
      let finalStatus = initialStatus;

      while (finalStatus.building && (Date.now() - pollStart) < pollTimeout) {
        await new Promise(r => setTimeout(r, 15000));
        finalStatus = getBuildStatus(buildUrl, consoleLines);
      }

      const buildResult = finalStatus.building ? 'TIMEOUT' : (finalStatus.result || 'UNKNOWN');
      lines.push(`=== RESULT: #${finalStatus.number || '?'} ${buildResult} ===`);

      if (finalStatus.consoleLines.length > 0) {
        lines.push('--- console ---');
        lines.push(...finalStatus.consoleLines);
        lines.push('---');
      }

      // Update last build state
      setLastBuild({
        target,
        queueUrl: triggerResult.queueUrl!,
        buildUrl,
        buildNumber: finalStatus.number ?? undefined,
        timestamp: Date.now(),
      });

      // --- Step 4: Post-build verification (only on SUCCESS) ---
      if (verify && buildResult === 'SUCCESS') {
        lines.push('');
        lines.push('=== POST-BUILD VERIFICATION ===');

        // Healthchecks
        const endpoints = getEndpoints();
        if (endpoints.length > 0) {
          const results = await Promise.all(
            endpoints.map(async (ep) => {
              const method = ep.method || 'GET';
              const expectedStatus = ep.expectedStatus || 200;
              const timeoutMs = ep.timeoutMs || 5000;
              const r = await fetchHealthcheck(ep.url, method, timeoutMs, ep.headers);
              const pass = !r.error && r.status === expectedStatus;
              return { name: ep.name, pass, status: r.error || `${r.status}`, durationMs: r.durationMs };
            }),
          );

          const failed = results.filter(r => !r.pass).length;
          const summary = failed === 0
            ? `Healthcheck: All ${results.length} endpoints OK`
            : `Healthcheck: ${failed}/${results.length} FAILING`;
          lines.push(summary);

          for (const r of results) {
            const icon = r.pass ? 'OK' : 'FAIL';
            lines.push(`  [${icon}] ${r.name}: ${r.status} (${r.durationMs}ms)`);
          }
        } else {
          lines.push('Healthcheck: No endpoints configured');
        }
      } else if (buildResult !== 'SUCCESS') {
        lines.push('');
        lines.push('Skipped verification — build did not succeed.');
      }

      return textResult(lines.join('\n'));
    },
  );
}
