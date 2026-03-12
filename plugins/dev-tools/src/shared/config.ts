import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

interface DevToolsConfig {
  profile: string;
  tagKey: string;
  tagValue: string;
}

const DEFAULTS: DevToolsConfig = {
  profile: 'basic_profile',
  tagKey: 'acc-sandbox',
  tagValue: 'core,profile,report,doc,ui,my',
};

const CONFIG_DIR = join(homedir(), '.config', 'dev-tools');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

let current: DevToolsConfig | null = null;

function load(): DevToolsConfig {
  if (current) return current;
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    current = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    current = { ...DEFAULTS };
  }
  return current!;
}

function save(config: DevToolsConfig): void {
  current = config;
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function set<K extends keyof DevToolsConfig>(key: K, value: DevToolsConfig[K]): void {
  save({ ...load(), [key]: value });
}

export function getProfile(): string { return load().profile; }
export function setProfile(name: string): void { set('profile', name); }

export function getTagKey(): string { return load().tagKey; }
export function setTagKey(key: string): void { set('tagKey', key); }

export function getTagValue(): string { return load().tagValue; }
export function setTagValue(value: string): void { set('tagValue', value); }

export function getConfig(): DevToolsConfig {
  return { ...load() };
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
