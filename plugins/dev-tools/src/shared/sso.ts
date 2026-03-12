import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

export const SSO_PROFILE = 'sso';
export const SSO_CRED_PROFILE = '265515193476_DeveloperAccessRole@697698820969';

export interface SsoExpiry {
  expiresAt: string;
  expiresEpochMs: number;
}

export interface AwsResult {
  stdout: string;
  stderr: string;
  status: number;
}

/**
 * Run an AWS CLI command. Uses stdio: 'inherit' for interactive commands (sso login).
 */
export function runAws(args: string[], interactive = false): AwsResult {
  const result = spawnSync('aws', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: interactive ? 'inherit' : 'pipe',
    timeout: interactive ? 120_000 : 30_000,
  });
  return {
    stdout: (result.stdout as string) ?? '',
    stderr: (result.stderr as string) ?? '',
    status: result.status ?? 1,
  };
}

/**
 * Read SSO token expiry from the local cache (no API call).
 * Returns null if no valid cached token is found.
 */
export function getSsoExpiry(): SsoExpiry | null {
  const cacheDir = join(homedir(), '.aws', 'sso', 'cache');

  let files: string[];
  try {
    files = readdirSync(cacheDir).filter(f => f.endsWith('.json'));
  } catch {
    return null;
  }

  const withExpiry = files.map(f => {
    const full = join(cacheDir, f);
    try {
      const raw = readFileSync(full, 'utf8');
      const data = JSON.parse(raw);
      if (data.providerType) return null;
      if (!data.expiresAt) return null;
      return { path: full, expiresAt: data.expiresAt as string };
    } catch {
      return null;
    }
  }).filter(Boolean) as { path: string; expiresAt: string }[];

  if (withExpiry.length === 0) return null;

  // Pick the one with the latest expiry (reduce avoids sorting the full array)
  const best = withExpiry.reduce((a, b) => b.expiresAt.localeCompare(a.expiresAt) > 0 ? b : a);

  const expiresEpochMs = new Date(best.expiresAt).getTime();
  if (isNaN(expiresEpochMs)) return null;

  return { expiresAt: best.expiresAt, expiresEpochMs };
}
