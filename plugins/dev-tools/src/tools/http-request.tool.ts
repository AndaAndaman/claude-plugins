import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult, errMsg } from '../shared/mcp-helpers.js';
import { httpRequest, HttpResponse } from '../shared/http.js';

function formatResponse(resp: HttpResponse, showHeaders: boolean): string {
  const lines: string[] = [`HTTP ${resp.status}${resp.ok ? '' : ' (error)'}`];

  if (showHeaders && Object.keys(resp.headers).length > 0) {
    lines.push('');
    for (const [k, v] of Object.entries(resp.headers)) {
      lines.push(`${k}: ${v}`);
    }
  }

  if (resp.body) {
    lines.push('');
    // Try to pretty-print JSON
    try {
      const parsed = JSON.parse(resp.body);
      lines.push(JSON.stringify(parsed, null, 2));
    } catch {
      lines.push(resp.body);
    }
  }

  return lines.join('\n');
}

export function registerHttpRequestTool(server: McpServer): void {
  defineTool(
    server,
    'http_request',
    'Make HTTP requests (GET, POST, PUT, PATCH, DELETE). Supports custom headers, JSON body, basic auth, and follows redirects. Example: {url: "https://api.example.com/data", method: "GET"}',
    {
      url: z.string().describe('Request URL'),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
        .optional().default('GET').describe('HTTP method (default: GET)'),
      headers: z.string().optional().describe('Headers as JSON object, e.g. {"Authorization": "Bearer token"}'),
      body: z.string().optional().describe('Request body (string or JSON). Content-Type defaults to application/json if body is provided'),
      auth: z.string().optional().describe('Basic auth as "user:password"'),
      timeout: z.number().optional().describe('Timeout in ms (default: 30000)'),
      show_headers: z.boolean().optional().describe('Include response headers in output (default: false)'),
    },
    async (input) => {
      const url = input.url as string;
      const method = (input.method as string) || 'GET';
      const timeout = (input.timeout as number) || 30000;
      const showHeaders = (input.show_headers as boolean) || false;

      // Parse headers JSON if provided
      let headers: Record<string, string> | undefined;
      if (input.headers) {
        try {
          headers = JSON.parse(input.headers as string);
        } catch {
          return errorResult('Invalid headers JSON. Provide a JSON object like {"Key": "Value"}');
        }
      }

      try {
        const resp = httpRequest(url, {
          method,
          headers,
          body: input.body as string | undefined,
          auth: input.auth as string | undefined,
          timeout,
        });
        return textResult(formatResponse(resp, showHeaders));
      } catch (err) {
        return errorResult(`Request failed: ${errMsg(err)}`);
      }
    },
  );
}
