import { spawnSync } from 'node:child_process';

export interface GitResult {
  stdout: string;
  stderr: string;
  ok: boolean;
}

export function git(...args: string[]): GitResult {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
    timeout: 60000,
  });
  return {
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    ok: result.status === 0,
  };
}

export function currentBranch(): string | null {
  const { stdout, ok } = git('branch', '--show-current');
  return ok && stdout ? stdout : null;
}
