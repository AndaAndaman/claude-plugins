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
  return current;
}

function save(): void {
  const config = load();
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export function getProfile(): string {
  return load().profile;
}

export function setProfile(name: string): void {
  load().profile = name;
  save();
}

export function getTagKey(): string {
  return load().tagKey;
}

export function setTagKey(key: string): void {
  load().tagKey = key;
  save();
}

export function getTagValue(): string {
  return load().tagValue;
}

export function setTagValue(value: string): void {
  load().tagValue = value;
  save();
}

export function getConfig(): DevToolsConfig {
  return { ...load() };
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
