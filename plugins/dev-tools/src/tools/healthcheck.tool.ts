import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import {
  getEndpoints,
  getEndpoint,
  addEndpoint,
  editEndpoint,
  removeEndpoint,
  getHealthcheckConfigPath,
} from '../shared/healthcheck.js';

interface FetchResult {
  status: number;
  ok: boolean;
  durationMs: number;
  body?: string;
  error?: string;
}

async function fetchWithTimeout(
  url: string,
  method: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<FetchResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: headers || {},
    });
    const body = await res.text().catch(() => '');
    return { status: res.status, ok: res.ok, durationMs: Date.now() - start, body };
  } catch (err: any) {
    const msg = controller.signal.aborted ? `Timeout after ${timeoutMs}ms` : String(err.message || err);
    return { status: 0, ok: false, durationMs: Date.now() - start, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

function formatBody(body?: string): string {
  if (!body) return '';
  try {
    const json = JSON.parse(body);
    const fields: string[] = [];
    // Extract common build info fields
    for (const key of ['gitHash', 'git_hash', 'commitHash', 'commit', 'version', 'buildTime', 'build_time', 'buildDate', 'build_date', 'timestamp', 'env', 'environment']) {
      if (json[key] !== undefined) fields.push(`${key}: ${json[key]}`);
    }
    // If no known fields found, show compact JSON
    if (fields.length === 0) {
      const compact = JSON.stringify(json);
      return compact.length > 200 ? compact.slice(0, 200) + '...' : compact;
    }
    return fields.join(', ');
  } catch {
    // Plain text response
    const trimmed = body.trim();
    return trimmed.length > 200 ? trimmed.slice(0, 200) + '...' : trimmed;
  }
}

export function registerHealthcheckTool(server: McpServer): void {
  defineTool(
    server,
    'healthcheck',
    'Check health of configured endpoints, or manage the endpoint list (add/edit/remove/list).',
    {
      action: z
        .enum(['check', 'list', 'add', 'edit', 'remove'])
        .describe('check=run healthchecks, list=show endpoints, add/edit/remove=manage endpoints'),
      name: z.string().optional().describe('Endpoint name (required for add/edit/remove, optional for check to target one)'),
      url: z.string().optional().describe('Endpoint URL (required for add, optional for edit)'),
      method: z.enum(['GET', 'HEAD']).optional().describe('HTTP method (default GET)'),
      expected_status: z.number().optional().describe('Expected HTTP status code (default 200)'),
      timeout_ms: z.number().optional().describe('Request timeout in ms (default 5000)'),
      headers: z.string().optional().describe('JSON string of headers, e.g. {"Authorization":"Bearer xxx"}'),
    },
    async (input) => {
      const action = input.action as string;

      // --- LIST ---
      if (action === 'list') {
        const eps = getEndpoints();
        if (eps.length === 0) {
          return textResult(`No healthcheck endpoints configured.\nConfig: ${getHealthcheckConfigPath()}`);
        }
        const lines = eps.map(
          (e) =>
            `  ${e.name}: ${e.method || 'GET'} ${e.url} (expect ${e.expectedStatus || 200}, timeout ${e.timeoutMs || 5000}ms)`,
        );
        return textResult(`Healthcheck endpoints (${eps.length}):\n${lines.join('\n')}\n\nConfig: ${getHealthcheckConfigPath()}`);
      }

      // --- ADD ---
      if (action === 'add') {
        if (!input.name || !input.url) return errorResult('Error: add requires name and url.');
        try {
          const headers = input.headers ? JSON.parse(input.headers as string) : undefined;
          addEndpoint({
            name: input.name as string,
            url: input.url as string,
            method: (input.method as 'GET' | 'HEAD') || undefined,
            expectedStatus: input.expected_status as number | undefined,
            timeoutMs: input.timeout_ms as number | undefined,
            headers,
          });
          return textResult(`Added endpoint "${input.name}": ${input.method || 'GET'} ${input.url}`);
        } catch (err: any) {
          return errorResult(err.message);
        }
      }

      // --- EDIT ---
      if (action === 'edit') {
        if (!input.name) return errorResult('Error: edit requires name.');
        try {
          const updates: Record<string, any> = {};
          if (input.url !== undefined) updates.url = input.url;
          if (input.method !== undefined) updates.method = input.method;
          if (input.expected_status !== undefined) updates.expectedStatus = input.expected_status;
          if (input.timeout_ms !== undefined) updates.timeoutMs = input.timeout_ms;
          if (input.headers !== undefined) updates.headers = JSON.parse(input.headers as string);
          if (Object.keys(updates).length === 0) return errorResult('Error: no fields to update.');
          editEndpoint(input.name as string, updates);
          return textResult(`Updated endpoint "${input.name}".`);
        } catch (err: any) {
          return errorResult(err.message);
        }
      }

      // --- REMOVE ---
      if (action === 'remove') {
        if (!input.name) return errorResult('Error: remove requires name.');
        try {
          removeEndpoint(input.name as string);
          return textResult(`Removed endpoint "${input.name}".`);
        } catch (err: any) {
          return errorResult(err.message);
        }
      }

      // --- CHECK ---
      if (action === 'check') {
        const eps = input.name ? [getEndpoint(input.name as string)].filter(Boolean) : getEndpoints();
        if (eps.length === 0) {
          return input.name
            ? errorResult(`Endpoint "${input.name}" not found.`)
            : errorResult('No endpoints configured. Use action=add to add one.');
        }

        const results = await Promise.all(
          eps.map(async (ep) => {
            const method = ep!.method || 'GET';
            const expectedStatus = ep!.expectedStatus || 200;
            const timeoutMs = ep!.timeoutMs || 5000;
            const r = await fetchWithTimeout(ep!.url, method, timeoutMs, ep!.headers);
            const pass = !r.error && r.status === expectedStatus;
            const icon = pass ? 'OK' : 'FAIL';
            const status = r.error ? r.error : `${r.status} (${r.durationMs}ms)`;
            const body = pass ? formatBody(r.body) : '';
            const line = body
              ? `  [${icon}] ${ep!.name}: ${status}\n         ${body}`
              : `  [${icon}] ${ep!.name}: ${status}`;
            return line;
          }),
        );

        const total = results.length;
        const failed = results.filter((r) => r.includes('[FAIL]')).length;
        const summary = failed === 0 ? `All ${total} endpoints healthy.` : `${failed}/${total} endpoints failing.`;

        return textResult(`${summary}\n\n${results.join('\n')}`);
      }

      return errorResult('Unknown action.');
    },
  );
}
