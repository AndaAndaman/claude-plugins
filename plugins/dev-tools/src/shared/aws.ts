import { spawnSync } from 'node:child_process';
import { getProfile } from './config.js';

export interface AwsResult {
  stdout: string;
  stderr: string;
  status: number;
}

export function runAws(args: string[]): AwsResult {
  const result = spawnSync('aws', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

export function runAwsWithProfile(args: string[]): AwsResult {
  return runAws([...args, '--profile', getProfile()]);
}
