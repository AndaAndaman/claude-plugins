/**
 * MCP Tool: jenkins_build — trigger a Jenkins build via REST API.
 *
 * Config resolution order:
 *  1. Env vars: JENKINS_URL, JENKINS_USER, JENKINS_TOKEN → minimal config (no targets)
 *  2. ~/.ggd/jenkins.json → full config with targets and jobPaths
 *  3. Neither → error
 */

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BuildTarget {
  name: string;
  displayName: string;
  jobPathKey: string;
  jobPathOverride?: string;
  defaults: Record<string, string>;
}

interface JenkinsConfig {
  url: string;
  user: string;
  token: string;
  jobPaths: Record<string, string>;
  targets: BuildTarget[];
}

interface JenkinsHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

interface QueueResponse {
  executable?: { url?: string };
  why?: string;
  id?: number;
  blocked?: boolean;
}

interface BuildResponse {
  result?: string;
  number?: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

function readJenkinsConfig(): JenkinsConfig | null {
  // Priority 1: env vars
  const envUrl = process.env['JENKINS_URL'];
  const envUser = process.env['JENKINS_USER'];
  const envToken = process.env['JENKINS_TOKEN'];
  if (envUrl && envUser && envToken) {
    return { url: envUrl, user: envUser, token: envToken, jobPaths: {}, targets: [] };
  }

  // Priority 2: ~/.ggd/jenkins.json
  const configPath = path.join(os.homedir(), '.ggd', 'jenkins.json');
  try {
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as JenkinsConfig;
  } catch {
    return null;
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function jenkinsRequest(
  config: JenkinsConfig,
  urlPath: string,
  method: string,
  body?: string,
  extraHeaders: Record<string, string> = {}
): Promise<JenkinsHttpResponse> {
  return new Promise((resolve, reject) => {
    const fullUrl = urlPath.startsWith('http') ? urlPath : `${config.url}${urlPath}`;
    const parsedUrl = new URL(fullUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const auth = Buffer.from(`${config.user}:${config.token}`).toString('base64');
    const reqHeaders: Record<string, string> = {
      Authorization: `Basic ${auth}`,
      ...extraHeaders,
    };

    if (body) {
      reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      reqHeaders['Content-Length'] = Buffer.byteLength(body).toString();
    }

    const req = lib.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: data,
          });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fetchCrumb(config: JenkinsConfig): Promise<string | null> {
  try {
    const res = await jenkinsRequest(config, '/crumbIssuer/api/json', 'GET');
    const json = JSON.parse(res.body) as { crumb?: string };
    return json.crumb ?? null;
  } catch {
    return null;
  }
}

async function triggerBuild(
  config: JenkinsConfig,
  jobPath: string,
  params: Record<string, string>
): Promise<string | null> {
  const crumb = await fetchCrumb(config);
  const formBody = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const headers: Record<string, string> = {};
  if (crumb) headers['Jenkins-Crumb'] = crumb;

  const res = await jenkinsRequest(
    config,
    `/job/${jobPath}/buildWithParameters`,
    'POST',
    formBody,
    headers
  );

  const location = res.headers['location'];
  return typeof location === 'string' && location ? location : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBuild(config: JenkinsConfig, queueUrl: string): Promise<string | null> {
  const apiUrl = queueUrl.endsWith('/') ? `${queueUrl}api/json` : `${queueUrl}/api/json`;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await jenkinsRequest(config, apiUrl, 'GET');
      const json = JSON.parse(res.body) as QueueResponse;
      if (json.executable?.url) return json.executable.url;
    } catch {
      // transient — retry
    }
    await sleep(2000);
  }
  return null;
}

async function watchBuild(config: JenkinsConfig, buildUrl: string): Promise<string> {
  const apiUrl = buildUrl.endsWith('/') ? `${buildUrl}api/json` : `${buildUrl}/api/json`;
  for (let i = 0; i < 360; i++) {
    try {
      const res = await jenkinsRequest(config, apiUrl, 'GET');
      const json = JSON.parse(res.body) as BuildResponse;
      if (json.result && json.result !== 'null') {
        return `${json.result} (#${json.number ?? '?'})`;
      }
    } catch {
      // transient — retry
    }
    await sleep(5000);
  }
  return 'TIMEOUT';
}

// ─── Pure utilities ───────────────────────────────────────────────────────────

function findTarget(name: string, targets: BuildTarget[]): BuildTarget | undefined {
  return targets.find((t) => t.name === name);
}

function mergeParams(
  defaults: Record<string, string>,
  overrides: Record<string, string>
): Record<string, string> {
  return { ...defaults, ...overrides };
}

function resolveJobPath(target: BuildTarget, config: JenkinsConfig): string {
  if (target.jobPathOverride) return target.jobPathOverride;
  return config.jobPaths[target.jobPathKey] ?? '';
}

// ─── Tool registration ────────────────────────────────────────────────────────

export function registerJenkinsBuildTool(server: McpServer): void {
  server.registerTool(
    'jenkins_build',
    {
      description:
        'Trigger a Jenkins build for a configured target. Omit target to list available targets.',
      inputSchema: {
        target: z.string().optional().describe('Build target name (omit to list available targets)'),
        overrides: z
          .record(z.string(), z.string())
          .optional()
          .describe('Parameter overrides as key-value pairs (e.g., {"COMMIT_HASH": "main"})'),
        detach: z
          .boolean()
          .default(false)
          .describe('If true, trigger build and return immediately without watching'),
      },
    },
    async (input) => {
      try {
        const config = readJenkinsConfig();
        if (!config) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No Jenkins config found. Set JENKINS_URL, JENKINS_USER, JENKINS_TOKEN env vars, or run jenkins setup to create ~/.ggd/jenkins.json.',
              },
            ],
            isError: true,
          };
        }

        const targets = config.targets;

        // No target — list available
        if (!input.target) {
          if (targets.length === 0) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'No build targets configured. Add targets to ~/.ggd/jenkins.json or use env vars (JENKINS_URL/USER/TOKEN) for direct builds.',
                },
              ],
            };
          }
          const lines = ['Available build targets:', ''];
          for (const t of targets) {
            lines.push(`  ${t.name.padEnd(20)} ${t.displayName}`);
            for (const [k, v] of Object.entries(t.defaults)) {
              lines.push(`    ${k}=${v || '<empty>'}`);
            }
          }
          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        }

        // Resolve target
        const target = findTarget(input.target, targets);
        if (!target) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Unknown target: ${input.target}. Available: ${targets.map((t) => t.name).join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        const overrides = input.overrides ?? {};
        const params = mergeParams(target.defaults, overrides);
        const jobPath = resolveJobPath(target, config);

        const info = [
          `Target: ${target.displayName}`,
          `Job: ${config.url}/job/${jobPath}`,
          'Params:',
          ...Object.entries(params).map(([k, v]) => `  ${k}=${v || '<empty>'}`),
          '',
          'Triggering build...',
        ];

        const queueUrl = await triggerBuild(config, jobPath, params);
        if (!queueUrl) {
          info.push('Failed to trigger build. Check Jenkins URL / API token.');
          return {
            content: [{ type: 'text' as const, text: info.join('\n') }],
            isError: true,
          };
        }

        info.push(`Queued: ${queueUrl}`);

        if (input.detach) {
          info.push('Detached mode — build queued, not watching.');
          return { content: [{ type: 'text' as const, text: info.join('\n') }] };
        }

        const buildUrl = await waitForBuild(config, queueUrl);
        if (!buildUrl) {
          info.push('Timed out waiting for build to start.');
          return {
            content: [{ type: 'text' as const, text: info.join('\n') }],
            isError: true,
          };
        }

        info.push(`Build started: ${buildUrl}`);

        const result = await watchBuild(config, buildUrl);
        info.push(`Build result: ${result}`);

        return {
          content: [{ type: 'text' as const, text: info.join('\n') }],
          isError: !result.startsWith('SUCCESS'),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const safe = message.replace(/https?:\/\/[^@\s]+@/g, 'https://***@');
        return {
          content: [{ type: 'text' as const, text: `Build error: ${safe}` }],
          isError: true,
        };
      }
    }
  );
}
