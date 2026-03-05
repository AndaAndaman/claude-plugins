import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const SSO_PROFILE = 'sso';
export const SSO_CRED_PROFILE = '265515193476_DeveloperAccessRole@697698820969';

interface SsoExpiry {
  expiresAt: string;
  expiresEpochMs: number;
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

  // Sort by mtime descending (most recent first)
  const withMtime = files.map(f => {
    const full = join(cacheDir, f);
    try {
      const raw = readFileSync(full, 'utf8');
      const data = JSON.parse(raw);
      // Skip provider-type entries (not actual SSO tokens)
      if (data.providerType) return null;
      if (!data.expiresAt) return null;
      return { path: full, expiresAt: data.expiresAt as string };
    } catch {
      return null;
    }
  }).filter(Boolean) as { path: string; expiresAt: string }[];

  if (withMtime.length === 0) return null;

  // Pick the one with the latest expiry
  withMtime.sort((a, b) => b.expiresAt.localeCompare(a.expiresAt));
  const best = withMtime[0];

  const expiresEpochMs = new Date(best.expiresAt).getTime();
  if (isNaN(expiresEpochMs)) return null;

  return { expiresAt: best.expiresAt, expiresEpochMs };
}
