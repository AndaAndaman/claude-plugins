import { spawnSync } from 'node:child_process';

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  ok: boolean;
}

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  auth?: string;             // "user:password" for basic auth
  timeout?: number;          // ms, default 30000
  followRedirects?: boolean; // default true
  rawBody?: boolean;         // skip content-type auto-set
}

export function httpRequest(url: string, opts: HttpOptions = {}): HttpResponse {
  const {
    method = 'GET',
    headers,
    body,
    auth,
    timeout = 30000,
    followRedirects = true,
    rawBody = false,
  } = opts;

  const args = [
    '-s',
    '-i',
    '--max-time', String(Math.ceil(timeout / 1000)),
    '-X', method,
  ];

  if (followRedirects) args.push('-L');
  if (auth) args.push('-u', auth);

  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      args.push('-H', `${k}: ${v}`);
    }
  }

  if (body) {
    args.push('-d', body);
    if (!rawBody && (!headers || !Object.keys(headers).some(k => k.toLowerCase() === 'content-type'))) {
      args.push('-H', 'Content-Type: application/json');
    }
  }

  args.push(url);

  const result = spawnSync('curl', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout,
  });

  if (result.status !== 0 && !result.stdout) {
    return { status: 0, headers: {}, body: result.stderr || 'curl failed', ok: false };
  }

  const raw = result.stdout || '';

  // Find last header block (handle redirect chains)
  const sections = raw.split(/\r?\n\r?\n/);
  let lastHeaderIdx = 0;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].match(/^HTTP\//)) lastHeaderIdx = i;
  }

  const headerBlock = sections[lastHeaderIdx] || '';
  const responseBody = sections.slice(lastHeaderIdx + 1).join('\n\n');

  const statusMatch = headerBlock.match(/HTTP\/[\d.]+ (\d+)/);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

  const parsedHeaders: Record<string, string> = {};
  for (const line of headerBlock.split(/\r?\n/).slice(1)) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      parsedHeaders[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
  }

  return { status, headers: parsedHeaders, body: responseBody, ok: status >= 200 && status < 400 };
}
