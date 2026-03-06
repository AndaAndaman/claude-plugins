import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

// ---------- Config ----------

export interface JenkinsConfig {
  url: string;
  user: string;
  token: string;
  environment: 'staging' | 'preprod';
  jobPaths: {
    ui: string;
    api: string;
    lambda: string;
  };
}

const STAGING_JOBS = {
  ui: 'staging/job/workspace/job/frontend',
  api: 'staging/job/dotnet/job/dotnet.arm64',
  lambda: 'staging/job/workspace/job/serverless',
};

const PREPROD_JOBS = {
  ui: 'preprod/job/workspace/job/frontend',
  api: 'preprod/job/dotnet/job/dotnet.arm64',
  lambda: 'preprod/job/workspace/job/lambda',
};

const CONFIG_DIR = join(homedir(), '.config', 'dev-tools');
const JENKINS_CONFIG_FILE = join(CONFIG_DIR, 'jenkins.json');

const DEFAULTS: JenkinsConfig = {
  url: 'http://jenkins-workspace.flowaccount.private',
  user: 'anda',
  token: '',
  environment: 'staging',
  jobPaths: STAGING_JOBS,
};

let cached: JenkinsConfig | null = null;

export function loadJenkinsConfig(): JenkinsConfig {
  if (cached) return cached;
  try {
    const raw = readFileSync(JENKINS_CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cached = { ...DEFAULTS, ...parsed };
    // Ensure jobPaths match environment
    if (cached!.environment === 'preprod') {
      cached!.jobPaths = { ...PREPROD_JOBS, ...parsed.jobPaths };
    } else {
      cached!.jobPaths = { ...STAGING_JOBS, ...parsed.jobPaths };
    }
  } catch {
    cached = { ...DEFAULTS, jobPaths: { ...STAGING_JOBS } };
  }
  return cached!;
}

export function saveJenkinsConfig(config: Partial<JenkinsConfig>): void {
  const current = loadJenkinsConfig();
  Object.assign(current, config);

  // Auto-set jobPaths based on environment
  if (config.environment) {
    current.jobPaths = config.environment === 'preprod' ? { ...PREPROD_JOBS } : { ...STAGING_JOBS };
  }

  cached = current;
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(JENKINS_CONFIG_FILE, JSON.stringify(current, null, 2) + '\n', 'utf8');
}

export function getJenkinsConfigPath(): string {
  return JENKINS_CONFIG_FILE;
}

// ---------- Build Targets ----------

export interface BuildTarget {
  name: string;
  description: string;
  jobPathKey: 'ui' | 'api' | 'lambda';
  jobPathOverride?: string; // for special cases like lambda-pdf-preview
  defaults: Record<string, string>;
}

export const BUILD_TARGETS: Record<string, BuildTarget> = {
  ui: {
    name: 'ui',
    description: 'UI/Frontend service',
    jobPathKey: 'ui',
    defaults: {
      COMMIT_HASH: 'a-staging',
      SITE: 'acc',
      SERVICE_NAME: 'ui',
      FORCE_YARN: 'false',
      SOURCE_MAP_ENABLE: 'false',
      NX_RESET: 'false',
    },
  },
  api: {
    name: 'api',
    description: 'API Core service',
    jobPathKey: 'api',
    defaults: {
      COMMIT_HASH: 'canary-staging',
      BUILD_SITE: 'acc',
      SERVICE_NAME: 'api-core',
      BASE_DOCKER: 'business-api',
      NS: '',
      STAGE: 'sandbox',
      PARAM_LOG_LEVEL: 'none',
      STOP_TASK_BEFORE_FORCE_NEW_DEPLOYMENT: 'false',
    },
  },
  'api-report': {
    name: 'api-report',
    description: 'Report API service',
    jobPathKey: 'api',
    defaults: {
      COMMIT_HASH: 'canary-staging',
      BUILD_SITE: 'acc',
      SERVICE_NAME: 'report-api',
      BASE_DOCKER: 'report-api',
      NS: '',
      STAGE: 'sandbox',
      PARAM_LOG_LEVEL: 'none',
      STOP_TASK_BEFORE_FORCE_NEW_DEPLOYMENT: 'false',
    },
  },
  'api-doc': {
    name: 'api-doc',
    description: 'Document API service',
    jobPathKey: 'api',
    defaults: {
      COMMIT_HASH: 'canary-staging',
      BUILD_SITE: 'acc',
      SERVICE_NAME: 'doc-api',
      BASE_DOCKER: 'doc-api',
      NS: '',
      STAGE: 'sandbox',
      PARAM_LOG_LEVEL: 'none',
      STOP_TASK_BEFORE_FORCE_NEW_DEPLOYMENT: 'false',
    },
  },
  'api-profile': {
    name: 'api-profile',
    description: 'Profile API service',
    jobPathKey: 'api',
    defaults: {
      COMMIT_HASH: 'canary-staging',
      BUILD_SITE: 'acc',
      SERVICE_NAME: 'profile-api',
      BASE_DOCKER: 'profile-api',
      NS: '',
      STAGE: 'sandbox',
      PARAM_LOG_LEVEL: 'none',
      STOP_TASK_BEFORE_FORCE_NEW_DEPLOYMENT: 'false',
    },
  },
  'open-api': {
    name: 'open-api',
    description: 'Open API service',
    jobPathKey: 'api',
    defaults: {
      COMMIT_HASH: 'canary-staging',
      BUILD_SITE: '',
      SERVICE_NAME: 'open-api',
      BASE_DOCKER: 'open-api',
      NS: '-ns',
      STAGE: 'sandbox-ns',
      PARAM_LOG_LEVEL: 'none',
      STOP_TASK_BEFORE_FORCE_NEW_DEPLOYMENT: 'false',
    },
  },
  'lambda-pdf-preview': {
    name: 'lambda-pdf-preview',
    description: 'Lambda PDF Preview',
    jobPathKey: 'lambda',
    jobPathOverride: 'staging/job/workspace/job/lambda-pdf-preview-build',
    defaults: {
      BranchName: 'main',
      lambda: 'lambda.pdf-preview',
      configuration: 'staging',
      AliasesName: 'staging-ac',
    },
  },
  'lambda-pdf-gen': {
    name: 'lambda-pdf-gen',
    description: 'Lambda PDF Generator',
    jobPathKey: 'lambda',
    defaults: {
      BranchName: 'a-staging',
      lambda: 'lambda.pdf-generator',
      configuration: 'staging',
      YarnBool: 'Yes',
    },
  },
};

// Environment-aware default overrides (preprod values differ from staging)
const PREPROD_OVERRIDES: Record<string, Record<string, string>> = {
  ui:              { COMMIT_HASH: 'a-preprod', SITE: 'ac' },
  api:             { COMMIT_HASH: 'canary-preprod', BUILD_SITE: 'ac', STAGE: 'preprod' },
  'api-report':    { COMMIT_HASH: 'canary-preprod', BUILD_SITE: 'ac', STAGE: 'preprod' },
  'api-doc':       { COMMIT_HASH: 'canary-preprod', BUILD_SITE: 'ac', STAGE: 'preprod' },
  'api-profile':   { COMMIT_HASH: 'canary-preprod', BUILD_SITE: 'ac', STAGE: 'preprod' },
  'open-api':      { COMMIT_HASH: 'canary-preprod', STAGE: 'preprod-ns' },
};

// ---------- HTTP helpers ----------

function curlJson(url: string, config: JenkinsConfig, method = 'GET', data?: string[]): { status: number; body: string; headers: string } {
  const auth = `${config.user}:${config.token}`;
  const args = ['-s', '-i', '-u', auth];

  if (method === 'POST') args.push('-X', 'POST');
  if (data) {
    for (const d of data) {
      args.push('--data', d);
    }
  }
  args.push(url);

  try {
    const raw = execSync(`curl ${args.map(a => `"${a}"`).join(' ')}`, {
      encoding: 'utf8',
      maxBuffer: 5 * 1024 * 1024,
      timeout: 30000,
    });

    // Split headers and body
    const parts = raw.split(/\r?\n\r?\n/);
    const headers = parts[0] || '';
    const body = parts.slice(1).join('\n\n');
    const statusMatch = headers.match(/HTTP\/[\d.]+ (\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

    return { status, body, headers };
  } catch (e: any) {
    return { status: 0, body: e.message || 'curl failed', headers: '' };
  }
}

// ---------- Jenkins API ----------

function getCrumb(config: JenkinsConfig): string | null {
  const { body } = curlJson(`${config.url}/crumbIssuer/api/json`, config);
  try {
    const data = JSON.parse(body);
    return data.crumb || null;
  } catch {
    return null;
  }
}

export interface TriggerResult {
  success: boolean;
  queueUrl?: string;
  error?: string;
}

export function triggerBuild(target: string, params: Record<string, string>): TriggerResult {
  const config = loadJenkinsConfig();

  if (!config.token) {
    return { success: false, error: 'Jenkins token not configured. Run jenkins_configure first.' };
  }

  const bt = BUILD_TARGETS[target];
  if (!bt) {
    return { success: false, error: `Unknown target: ${target}. Available: ${Object.keys(BUILD_TARGETS).join(', ')}` };
  }

  // Merge defaults with environment overrides, then user params
  const envOverrides = config.environment === 'preprod'
    ? (PREPROD_OVERRIDES[target] || {})
    : {};
  const merged = { ...bt.defaults, ...envOverrides, ...params };
  const jobPath = bt.jobPathOverride || config.jobPaths[bt.jobPathKey];
  const url = `${config.url}/job/${jobPath}/buildWithParameters`;

  // Build data params
  const data = Object.entries(merged).map(([k, v]) => `${k}=${v}`);

  // Get CSRF crumb
  const crumb = getCrumb(config);

  // Trigger
  const args = ['-s', '-i', '-u', `${config.user}:${config.token}`];
  if (crumb) args.push('-H', `Jenkins-Crumb: ${crumb}`);
  args.push('-X', 'POST');
  for (const d of data) {
    args.push('--data', d);
  }
  args.push(url);

  let raw: string;
  try {
    raw = execSync(`curl ${args.map(a => `"${a}"`).join(' ')}`, {
      encoding: 'utf8',
      maxBuffer: 5 * 1024 * 1024,
      timeout: 30000,
    });
  } catch (e: any) {
    return { success: false, error: `curl failed: ${e.message}` };
  }

  // Extract Location header for queue URL
  const locMatch = raw.match(/Location:\s*(\S+)/i);
  if (!locMatch) {
    const statusMatch = raw.match(/HTTP\/[\d.]+ (\d+)/);
    return { success: false, error: `Failed to trigger build (HTTP ${statusMatch?.[1] || '?'}). Check Jenkins URL/token.` };
  }

  return { success: true, queueUrl: locMatch[1].trim() };
}

export interface BuildStatus {
  building: boolean;
  result: string | null;
  number: number | null;
  url: string | null;
  consoleLines: string[];
}

export function getQueueStatus(queueUrl: string): { buildUrl?: string; waiting: boolean; reason?: string } {
  const config = loadJenkinsConfig();
  const { body } = curlJson(`${queueUrl}api/json`, config);

  try {
    const data = JSON.parse(body);
    const execUrl = data?.executable?.url;
    if (execUrl) {
      return { buildUrl: execUrl, waiting: false };
    }
    return { waiting: true, reason: data?.why || 'Waiting in queue' };
  } catch {
    return { waiting: true, reason: 'Cannot parse queue response' };
  }
}

export function getBuildStatus(buildUrl: string, consoleLines = 20): BuildStatus {
  const config = loadJenkinsConfig();

  // Get build JSON
  const { body: buildBody } = curlJson(`${buildUrl}api/json`, config);
  let building = true;
  let result: string | null = null;
  let number: number | null = null;

  try {
    const data = JSON.parse(buildBody);
    building = data.building ?? true;
    result = data.result ?? null;
    number = data.number ?? null;
  } catch { /* ignore */ }

  // Get console output
  let lines: string[] = [];
  try {
    const auth = `${config.user}:${config.token}`;
    const raw = execSync(`curl -s -u "${auth}" "${buildUrl}consoleText"`, {
      encoding: 'utf8',
      maxBuffer: 5 * 1024 * 1024,
      timeout: 15000,
    });
    const allLines = raw.split('\n');
    lines = allLines.slice(-consoleLines);
  } catch { /* ignore */ }

  return { building, result, number, url: buildUrl, consoleLines: lines };
}
