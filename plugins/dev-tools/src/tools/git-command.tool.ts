import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { spawnSync } from 'node:child_process';

function git(...args: string[]): { stdout: string; stderr: string; ok: boolean } {
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

function currentBranch(): string | null {
  const { stdout, ok } = git('branch', '--show-current');
  return ok && stdout ? stdout : null;
}

function mergeTo(target: string): string {
  const branch = currentBranch();
  if (!branch) return 'Error: not on a branch (detached HEAD).';
  if (branch === target) return `Already on ${target}.`;

  // Check for uncommitted changes
  const { stdout: status } = git('status', '--porcelain');
  if (status) return `Error: uncommitted changes. Commit or stash first.\n${status}`;

  const lines: string[] = [`Merging ${branch} → ${target}`];

  // Switch to target
  const checkout = git('checkout', target);
  if (!checkout.ok) return `Error switching to ${target}: ${checkout.stderr}`;
  lines.push(`Switched to ${target}`);

  // Pull latest target
  const pull = git('pull', '--ff-only');
  if (pull.ok) lines.push('Pulled latest');

  // Merge
  const merge = git('merge', branch, '--no-edit');
  if (!merge.ok) {
    git('merge', '--abort');
    git('checkout', branch);
    return `Merge conflict. Aborted and returned to ${branch}.\n${merge.stderr}`;
  }
  lines.push(`Merged ${branch} into ${target}`);

  // Switch back
  git('checkout', branch);
  lines.push(`Switched back to ${branch}`);

  return lines.join('\n');
}

function pullRebase(): string {
  const branch = currentBranch();
  if (!branch) return 'Error: not on a branch (detached HEAD).';

  const { stdout: status } = git('status', '--porcelain');
  if (status) return `Error: uncommitted changes. Commit or stash first.\n${status}`;

  const result = git('pull', '--rebase');
  if (!result.ok) {
    git('rebase', '--abort');
    return `Rebase failed. Aborted.\n${result.stderr}`;
  }
  return result.stdout || 'Already up to date.';
}

function rebase(base: string): string {
  const branch = currentBranch();
  if (!branch) return 'Error: not on a branch (detached HEAD).';
  if (branch === base) return `Already on ${base}. Use rebase instead.`;

  const { stdout: status } = git('status', '--porcelain');
  if (status) return `Error: uncommitted changes. Commit or stash first.\n${status}`;

  const lines: string[] = [`Rebasing ${branch} onto origin/${base}`];

  // Fetch latest
  const fetch = git('fetch', 'origin', base);
  if (!fetch.ok) return `Error fetching origin/${base}: ${fetch.stderr}`;
  lines.push(`Fetched origin/${base}`);

  // Rebase onto origin/base
  const result = git('rebase', `origin/${base}`);
  if (!result.ok) {
    git('rebase', '--abort');
    return `Rebase onto ${base} failed. Aborted.\n${result.stderr}`;
  }

  lines.push(result.stdout || `Rebased onto origin/${base}`);
  return lines.join('\n');
}

function cherryPick(commit: string): string {
  const branch = currentBranch();
  if (!branch) return 'Error: not on a branch (detached HEAD).';

  const { stdout: status } = git('status', '--porcelain');
  if (status) return `Error: uncommitted changes. Commit or stash first.\n${status}`;

  const result = git('cherry-pick', commit);
  if (!result.ok) {
    git('cherry-pick', '--abort');
    return `Cherry-pick failed. Aborted.\n${result.stderr}`;
  }

  // Show what was picked
  const log = git('log', '-1', '--oneline');
  return `Cherry-picked: ${log.stdout}`;
}

function gitStatus(): string {
  const branch = currentBranch() || '(detached HEAD)';
  const { stdout: porcelain } = git('status', '--porcelain');
  const { stdout: ahead } = git('rev-list', '--count', '@{u}..HEAD');
  const { stdout: behind } = git('rev-list', '--count', 'HEAD..@{u}');

  const lines: string[] = [`Branch: ${branch}`];

  const a = parseInt(ahead) || 0;
  const b = parseInt(behind) || 0;
  if (a || b) lines.push(`Ahead: ${a}  Behind: ${b}`);

  if (!porcelain) {
    lines.push('Clean working tree');
  } else {
    const files = porcelain.split('\n');
    const staged = files.filter(f => f[0] !== ' ' && f[0] !== '?').length;
    const modified = files.filter(f => f[1] === 'M' || f[1] === 'D').length;
    const untracked = files.filter(f => f.startsWith('??')).length;
    if (staged) lines.push(`Staged: ${staged}`);
    if (modified) lines.push(`Modified: ${modified}`);
    if (untracked) lines.push(`Untracked: ${untracked}`);
    lines.push('---');
    lines.push(...files.map(f => `  ${f}`));
  }
  return lines.join('\n');
}

function gitStash(pop?: boolean, message?: string): string {
  if (pop) {
    const list = git('stash', 'list');
    if (!list.stdout) return 'No stashes to pop.';
    const result = git('stash', 'pop');
    if (!result.ok) return `Stash pop failed: ${result.stderr}`;
    return `Popped stash. ${result.stdout}`;
  }

  const { stdout: status } = git('status', '--porcelain');
  if (!status) return 'Nothing to stash (clean working tree).';

  const args = ['stash', 'push', '--include-untracked'];
  if (message) args.push('-m', message);

  const result = git(...args);
  if (!result.ok) return `Stash failed: ${result.stderr}`;
  return result.stdout || 'Stashed changes.';
}

function gitStashList(): string {
  const result = git('stash', 'list');
  if (!result.ok) return `Error: ${result.stderr}`;
  if (!result.stdout) return 'No stashes.';
  return result.stdout;
}

function gitSwitch(branch: string, create?: boolean): string {
  if (create) {
    const result = git('checkout', '-b', branch);
    if (!result.ok) return `Error: ${result.stderr}`;
    return `Created and switched to ${branch}`;
  }

  const result = git('checkout', branch);
  if (!result.ok) return `Error: ${result.stderr}`;
  return `Switched to ${branch}`;
}

function gitResetSoft(count: number): string {
  const branch = currentBranch();
  if (!branch) return 'Error: not on a branch (detached HEAD).';

  // Show what will be undone
  const log = git('log', `--oneline`, `-${count}`);
  const result = git('reset', '--soft', `HEAD~${count}`);
  if (!result.ok) return `Reset failed: ${result.stderr}`;

  return `Undid ${count} commit(s) (changes kept staged):\n${log.stdout}`;
}

function gitFetch(): string {
  const result = git('fetch', '--all', '--prune');
  if (!result.ok) return `Fetch failed: ${result.stderr}`;
  return result.stderr || result.stdout || 'Fetched all remotes.';
}

function gitLog(count: number): string {
  const result = git('log', `--oneline`, `--graph`, `-${count}`);
  if (!result.ok) return `Error: ${result.stderr}`;
  return result.stdout || 'No commits.';
}

function branchCleanup(): string {
  const branch = currentBranch();
  const mainBranch = git('rev-parse', '--verify', 'main').ok ? 'main' : 'master';

  // Find merged branches (exclude current, main, master)
  const { stdout, ok } = git('branch', '--merged', mainBranch);
  if (!ok) return `Error listing merged branches.`;

  const branches = stdout
    .split('\n')
    .map(b => b.trim().replace(/^\*\s*/, ''))
    .filter(b => b && b !== 'main' && b !== 'master' && b !== branch);

  if (branches.length === 0) return 'No merged branches to clean up.';

  const lines: string[] = [`Deleting ${branches.length} merged branch(es):`];
  for (const b of branches) {
    const del = git('branch', '-d', b);
    lines.push(del.ok ? `  Deleted ${b}` : `  Failed: ${b} — ${del.stderr}`);
  }
  return lines.join('\n');
}

export function registerGitCommandTool(server: McpServer): void {
  defineTool(
    server,
    'git_command',
    'Git workflow shortcuts: status, stash/stash_pop/stash_list, switch (create/switch branch), merge_to, pull_rebase, rebase, cherry_pick, reset_soft, fetch, log, branch_cleanup.',
    {
      action: z.enum([
        'status', 'stash', 'stash_pop', 'stash_list', 'switch',
        'merge_to', 'pull_rebase', 'rebase', 'cherry_pick',
        'reset_soft', 'fetch', 'log', 'branch_cleanup',
      ]).describe(
        'status=branch+changes, stash=save WIP, stash_pop=restore WIP, stash_list=list stashes, switch=checkout/create branch, merge_to=merge current→target, pull_rebase=pull --rebase, rebase=onto origin branch, cherry_pick=pick commit, reset_soft=undo N commits (keep staged), fetch=fetch all remotes, log=recent commits, branch_cleanup=delete merged'
      ),
      target: z.string().optional().describe('Branch name for merge_to, rebase, or switch'),
      commit: z.string().optional().describe('Commit hash for cherry_pick'),
      count: z.number().optional().describe('Number of commits for reset_soft (default: 1) or log (default: 10)'),
      create: z.boolean().optional().describe('Create new branch for switch (default: false)'),
      message: z.string().optional().describe('Stash message (optional)'),
    },
    async (input) => {
      const action = input.action as string;

      if (action === 'status') return textResult(gitStatus());
      if (action === 'stash') return textResult(gitStash(false, input.message as string | undefined));
      if (action === 'stash_pop') return textResult(gitStash(true));
      if (action === 'stash_list') return textResult(gitStashList());

      if (action === 'switch') {
        if (!input.target) return errorResult('switch requires target branch name.');
        return textResult(gitSwitch(input.target as string, input.create as boolean | undefined));
      }

      if (action === 'merge_to') {
        if (!input.target) return errorResult('merge_to requires target branch name.');
        return textResult(mergeTo(input.target as string));
      }

      if (action === 'pull_rebase') return textResult(pullRebase());

      if (action === 'rebase') {
        return textResult(rebase((input.target as string) || 'main'));
      }

      if (action === 'cherry_pick') {
        if (!input.commit) return errorResult('cherry_pick requires commit hash.');
        return textResult(cherryPick(input.commit as string));
      }

      if (action === 'reset_soft') {
        return textResult(gitResetSoft((input.count as number) || 1));
      }

      if (action === 'fetch') return textResult(gitFetch());
      if (action === 'log') return textResult(gitLog((input.count as number) || 10));
      if (action === 'branch_cleanup') return textResult(branchCleanup());

      return errorResult('Unknown action.');
    },
  );
}
