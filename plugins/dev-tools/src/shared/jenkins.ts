import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { httpRequest } from './http.js';

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
  targetDefaults?: Record<string, Record<string, string>>;
}

const STAGING_JOBS = {
  ui: 'staging/job/workspace/job/frontend',
  api: 'staging/job/dotnet/job/dotnet.arm64',
  lambda: 'staging/job/workspace/job/serverless',
};

const PREPROD_JOBS = {
  ui: 'preprod/job/workspace/job/frontend',
  api: 'preprod/job/dotnet/job/dotnet.arm64',
  lambda: 'preprod/job/workspace/job/serverless',
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
  preprodDefaults?: Record<string, string>; // full replacement when env=preprod (different param schema)
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
      FORCE_YARN: 'true',
      SOURCE_MAP_ENABLE: 'false',
      NX_RESET: 'false',
    },
    preprodDefaults: {
      BUILD_BRANCH: 'a-preprod',
      BUILD_SITE: 'a',
      app_name: 'ui',
      SERVICE_NAME: 'new-ui',
      FORCE_YARN: 'yes',
      SOURCE_MAP_ENABLE: 'false',
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
    defaults: {
      BranchName: 'a-staging',
      lambda: 'lambda.pdf-preview',
      configuration: 'staging',
      YarnBool: 'Yes',
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
export const PREPROD_OVERRIDES: Record<string, Record<string, string>> = {
  api:             { COMMIT_HASH: 'canary-preprod', BUILD_SITE: 'ac', STAGE: 'preprod' },
  'api-report':    { COMMIT_HASH: 'canary-preprod', BUILD_SITE: 'ac', STAGE: 'preprod' },
  'api-doc':       { COMMIT_HASH: 'canary-preprod', BUILD_SITE: 'ac', STAGE: 'preprod' },
  'api-profile':   { COMMIT_HASH: 'canary-preprod', BUILD_SITE: 'ac', STAGE: 'preprod' },
  'open-api':      { COMMIT_HASH: 'canary-preprod', STAGE: 'preprod-ns' },
  'lambda-pdf-preview': { BranchName: 'a-preprod', configuration: 'preprod' },
  'lambda-pdf-gen':     { BranchName: 'a-preprod', configuration: 'preprod' },
};

// ---------- Helpers ----------

/** Get effective defaults for a target, considering environment and config overrides. */
export function getEffectiveDefaults(targetKey: string, target: BuildTarget, config: JenkinsConfig): Record<string, string> {
  // If target has full preprod replacement, use that instead of merge
  if (config.environment === 'preprod' && target.preprodDefaults) {
    const configOverrides = config.targetDefaults?.[targetKey] || {};
    return { ...target.preprodDefaults, ...configOverrides };
  }

  const envOverrides = config.environment === 'preprod'
    ? (PREPROD_OVERRIDES[targetKey] || {})
    : {};
  const configOverrides = config.targetDefaults?.[targetKey] || {};
  return { ...target.defaults, ...envOverrides, ...configOverrides };
}

export function resolveJobPath(target: BuildTarget, config: JenkinsConfig): string {
  if (target.jobPathOverride) {
    return target.jobPathOverride.replace('{env}', config.environment);
  }
  return config.jobPaths[target.jobPathKey];
}

// ---------- HTTP helpers ----------

function jenkinsAuth(config: JenkinsConfig): string {
  return `${config.user}:${config.token}`;
}

function jenkinsGet(url: string, config: JenkinsConfig, timeout = 30000): { status: number; body: string } {
  const resp = httpRequest(url, { auth: jenkinsAuth(config), timeout, followRedirects: false });
  return { status: resp.status, body: resp.body };
}

function jenkinsPost(url: string, config: JenkinsConfig, opts?: { headers?: Record<string, string>; body?: string; timeout?: number }): { status: number; body: string; headers: Record<string, string> } {
  const resp = httpRequest(url, {
    method: 'POST',
    auth: jenkinsAuth(config),
    headers: opts?.headers,
    body: opts?.body,
    timeout: opts?.timeout ?? 30000,
    followRedirects: false,
    rawBody: true,
  });
  return { status: resp.status, body: resp.body, headers: resp.headers };
}

// ---------- Jenkins API ----------

function getCrumb(config: JenkinsConfig): string | null {
  const { body } = jenkinsGet(`${config.url}/crumbIssuer/api/json`, config);
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

  // Merge effective defaults with user params
  const merged = { ...getEffectiveDefaults(target, bt, config), ...params };
  const jobPath = resolveJobPath(bt, config);
  const url = `${config.url}/job/${jobPath}/buildWithParameters`;

  // Build form body (URL-encoded)
  const formBody = Object.entries(merged)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // Get CSRF crumb
  const crumb = getCrumb(config);
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (crumb) headers['Jenkins-Crumb'] = crumb;

  const resp = jenkinsPost(url, config, { headers, body: formBody });

  // Extract Location header for queue URL
  const queueUrl = resp.headers['location'];
  if (!queueUrl) {
    return { success: false, error: `Failed to trigger build (HTTP ${resp.status}). Check Jenkins URL/token.` };
  }

  return { success: true, queueUrl: queueUrl.trim() };
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
  const base = queueUrl.replace(/\/$/, '');
  const { body } = jenkinsGet(`${base}/api/json`, config);

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

export function abortBuild(url: string): { success: boolean; error?: string } {
  const config = loadJenkinsConfig();
  if (!config.token) {
    return { success: false, error: 'Jenkins token not configured. Run jenkins_configure first.' };
  }

  // Support both build URLs and queue URLs
  const isQueue = url.includes('/queue/');
  const stopUrl = isQueue
    ? `${url.replace(/\/$/, '')}/cancelItem`
    : `${url.replace(/\/$/, '')}/stop`;

  const crumb = getCrumb(config);
  const headers: Record<string, string> = {};
  if (crumb) headers['Jenkins-Crumb'] = crumb;

  const resp = jenkinsPost(stopUrl, config, { headers, timeout: 15000 });
  if (resp.status >= 200 && resp.status < 400) {
    return { success: true };
  }
  return { success: false, error: `HTTP ${resp.status} from Jenkins` };
}

export function getBuildStatus(buildUrl: string, consoleLines = 20): BuildStatus {
  const config = loadJenkinsConfig();
  const base = buildUrl.replace(/\/$/, '');

  // Get build JSON
  const { body: buildBody } = jenkinsGet(`${base}/api/json`, config);
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
  const consoleResp = jenkinsGet(`${base}/consoleText`, config, 15000);
  if (consoleResp.body) {
    const allLines = consoleResp.body.split('\n');
    lines = allLines.slice(-consoleLines);
  }

  return { building, result, number, url: buildUrl, consoleLines: lines };
}
