import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface HealthcheckEndpoint {
  name: string;
  url: string;
  method?: 'GET' | 'HEAD';
  expectedStatus?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

interface HealthcheckConfig {
  endpoints: HealthcheckEndpoint[];
}

const DEFAULT_ENDPOINTS: HealthcheckEndpoint[] = [
  { name: 'open-api', url: 'https://open-api-sandbox.dev.flowaccount.com/healthcheck' },
  { name: 'api-core', url: 'https://api-core-acc.dev.flowaccount.com/api/healthcheck' },
  { name: 'report-prod', url: 'https://report-api-ac.flowaccount.com/api/healthcheck' },
  { name: 'report-dev', url: 'https://report-api-acc.dev.flowaccount.com/api/healthcheck' },
  { name: 'doc-api', url: 'https://doc-api-acc.dev.flowaccount.com/api/healthcheck' },
  { name: 'ui', url: 'https://ui-acc.dev.flowaccount.com/healthcheck' },
];

const CONFIG_DIR = join(homedir(), '.config', 'dev-tools');
const CONFIG_FILE = join(CONFIG_DIR, 'healthcheck.json');

let current: HealthcheckConfig | null = null;

function load(): HealthcheckConfig {
  if (current) return current;
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    current = JSON.parse(raw);
  } catch {
    current = { endpoints: [...DEFAULT_ENDPOINTS] };
  }
  return current!;
}

function save(): void {
  const config = load();
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export function getEndpoints(): HealthcheckEndpoint[] {
  return [...load().endpoints];
}

export function getEndpoint(name: string): HealthcheckEndpoint | undefined {
  return load().endpoints.find((e) => e.name === name);
}

export function addEndpoint(ep: HealthcheckEndpoint): void {
  const config = load();
  if (config.endpoints.some((e) => e.name === ep.name)) {
    throw new Error(`Endpoint "${ep.name}" already exists. Use edit to update.`);
  }
  config.endpoints.push(ep);
  save();
}

export function editEndpoint(name: string, updates: Partial<Omit<HealthcheckEndpoint, 'name'>>): void {
  const config = load();
  const idx = config.endpoints.findIndex((e) => e.name === name);
  if (idx === -1) throw new Error(`Endpoint "${name}" not found.`);
  config.endpoints[idx] = { ...config.endpoints[idx], ...updates };
  save();
}

export function removeEndpoint(name: string): void {
  const config = load();
  const idx = config.endpoints.findIndex((e) => e.name === name);
  if (idx === -1) throw new Error(`Endpoint "${name}" not found.`);
  config.endpoints.splice(idx, 1);
  save();
}

export function getHealthcheckConfigPath(): string {
  return CONFIG_FILE;
}
