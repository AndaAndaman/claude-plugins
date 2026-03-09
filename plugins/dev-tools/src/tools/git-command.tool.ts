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
    'Git workflow shortcuts: merge_to (merge current→target), pull_rebase (pull --rebase), rebase (rebase onto origin branch), cherry_pick, branch_cleanup (delete merged branches).',
    {
      action: z.enum(['merge_to', 'pull_rebase', 'rebase', 'cherry_pick', 'branch_cleanup']).describe(
        'merge_to=merge current branch into target, pull_rebase=git pull --rebase, rebase=fetch + rebase onto origin branch, cherry_pick=pick a commit, branch_cleanup=delete merged branches'
      ),
      target: z.string().optional().describe('Target branch for merge_to or rebase (e.g. "main", "canary"). Default: "main"'),
      commit: z.string().optional().describe('Commit hash for cherry_pick'),
    },
    async (input) => {
      const action = input.action as string;

      if (action === 'merge_to') {
        if (!input.target) return errorResult('merge_to requires target branch name.');
        return textResult(mergeTo(input.target as string));
      }

      if (action === 'pull_rebase') {
        return textResult(pullRebase());
      }

      if (action === 'rebase') {
        return textResult(rebase((input.target as string) || 'main'));
      }

      if (action === 'cherry_pick') {
        if (!input.commit) return errorResult('cherry_pick requires commit hash.');
        return textResult(cherryPick(input.commit as string));
      }

      if (action === 'branch_cleanup') {
        return textResult(branchCleanup());
      }

      return errorResult('Unknown action.');
    },
  );
}
