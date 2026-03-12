import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { git, currentBranch } from '../shared/git-helper.js';

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

function gitDiff(target?: string, staged?: boolean): string {
  const args = ['diff'];
  if (staged) args.push('--cached');
  if (target) args.push(target);
  args.push('--stat');

  const result = git(...args);
  if (!result.ok) return `Error: ${result.stderr}`;
  if (!result.stdout) return staged ? 'No staged changes.' : 'No changes.';
  return result.stdout;
}

function gitAdd(files: string): string {
  const paths = files.split(/[,\s]+/).filter(Boolean);
  if (paths.length === 0) return 'Error: no files specified.';

  const lines: string[] = [];
  for (const p of paths) {
    const result = git('add', p);
    lines.push(result.ok ? `  Added ${p}` : `  Failed: ${p} — ${result.stderr}`);
  }
  return lines.join('\n');
}

function gitRemove(files: string): string {
  const paths = files.split(/[,\s]+/).filter(Boolean);
  if (paths.length === 0) return 'Error: no files specified.';

  const lines: string[] = [];
  for (const p of paths) {
    const result = git('reset', 'HEAD', p);
    lines.push(result.ok ? `  Unstaged ${p}` : `  Failed: ${p} — ${result.stderr}`);
  }
  return lines.join('\n');
}

function gitPush(force?: boolean): string {
  const branch = currentBranch();
  if (!branch) return 'Error: not on a branch (detached HEAD).';

  const args = ['push', '-u', 'origin', branch];
  if (force) args.splice(1, 0, '--force-with-lease');

  const result = git(...args);
  if (!result.ok) return `Push failed: ${result.stderr}`;
  return result.stderr || result.stdout || `Pushed ${branch} to origin.`;
}

function gitPull(): string {
  const branch = currentBranch();
  if (!branch) return 'Error: not on a branch (detached HEAD).';

  const result = git('pull');
  if (!result.ok) return `Pull failed: ${result.stderr}`;
  return result.stdout || 'Already up to date.';
}

function gitCommit(message: string, files?: string): string {
  // Auto-add files if provided
  if (files) {
    const addResult = gitAdd(files);
    if (addResult.includes('Failed:')) return `Stage failed:\n${addResult}`;
  }

  // Check there's something to commit
  const { stdout: staged } = git('diff', '--cached', '--stat');
  if (!staged) return 'Nothing to commit (no staged changes).';

  const result = git('commit', '-m', message);
  if (!result.ok) return `Commit failed: ${result.stderr}`;

  const log = git('log', '-1', '--oneline');
  return `Committed: ${log.stdout}`;
}

function gitAmend(message?: string): string {
  const { stdout: staged } = git('diff', '--cached', '--stat');
  const args = ['commit', '--amend'];
  if (message) {
    args.push('-m', message);
  } else {
    args.push('--no-edit');
  }

  const result = git(...args);
  if (!result.ok) return `Amend failed: ${result.stderr}`;

  const log = git('log', '-1', '--oneline');
  return `Amended: ${log.stdout}${staged ? `\nNew staged changes included` : ''}`;
}

function gitTag(name?: string, del?: boolean): string {
  // List tags
  if (!name) {
    const result = git('tag', '--sort=-creatordate', '-n1');
    if (!result.ok) return `Error: ${result.stderr}`;
    return result.stdout || 'No tags.';
  }

  // Delete tag
  if (del) {
    const local = git('tag', '-d', name);
    const remote = git('push', 'origin', `:refs/tags/${name}`);
    const lines: string[] = [];
    lines.push(local.ok ? `Deleted local tag ${name}` : `Local delete failed: ${local.stderr}`);
    if (remote.ok) lines.push(`Deleted remote tag ${name}`);
    return lines.join('\n');
  }

  // Create and push tag
  const result = git('tag', name);
  if (!result.ok) return `Tag failed: ${result.stderr}`;
  const push = git('push', 'origin', name);
  if (!push.ok) return `Tag created locally but push failed: ${push.stderr}`;
  return `Created and pushed tag ${name}`;
}

function gitBranchList(all?: boolean): string {
  const args = ['branch', '-vv'];
  if (all) args.push('-a');

  const result = git(...args);
  if (!result.ok) return `Error: ${result.stderr}`;
  return result.stdout || 'No branches.';
}

function gitShow(ref: string): string {
  const result = git('show', '--stat', '--format=commit %H%nAuthor: %an <%ae>%nDate:   %ad%n%n    %s%n', ref);
  if (!result.ok) return `Error: ${result.stderr}`;
  return result.stdout;
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
    'Git workflow shortcuts: status, diff, log, add, remove, commit, amend, stash/stash_pop/stash_list, switch, branch_list, merge_to, pull, pull_rebase, push, rebase, cherry_pick, tag, show, reset_soft, fetch, branch_cleanup.',
    {
      action: z.enum([
        'status', 'diff', 'log', 'add', 'remove', 'commit', 'amend',
        'stash', 'stash_pop', 'stash_list', 'switch', 'branch_list',
        'merge_to', 'pull', 'pull_rebase', 'push', 'rebase', 'cherry_pick',
        'tag', 'show', 'reset_soft', 'fetch', 'branch_cleanup',
      ]).describe(
        'status=branch+changes, diff=show changes (stat), log=recent commits, add=stage files, remove=unstage files, commit=commit staged (or add+commit with files), amend=amend last commit, stash=save WIP, stash_pop=restore, stash_list=list, switch=checkout/create branch, branch_list=list branches, merge_to=merge current→target, pull=pull from remote, pull_rebase=pull --rebase, push=push to remote, rebase=onto origin branch, cherry_pick=pick commit, tag=create/list/delete tags, show=show commit details, reset_soft=undo N commits (keep staged), fetch=fetch all remotes, branch_cleanup=delete merged'
      ),
      target: z.string().optional().describe('Branch name for merge_to, rebase, switch, diff, or commit ref for show'),
      commit: z.string().optional().describe('Commit hash for cherry_pick or show'),
      count: z.number().optional().describe('Number of commits for reset_soft (default: 1) or log (default: 10)'),
      create: z.boolean().optional().describe('Create new branch for switch (default: false)'),
      staged: z.boolean().optional().describe('Show staged changes only for diff (default: false)'),
      force: z.boolean().optional().describe('Force push with lease for push (default: false)'),
      all: z.boolean().optional().describe('Include remote branches for branch_list (default: false)'),
      delete: z.boolean().optional().describe('Delete tag for tag action (default: false)'),
      files: z.string().optional().describe('File paths for add/remove/commit, comma or space separated'),
      message: z.string().optional().describe('Commit/amend message, or stash message'),
    },
    async (input) => {
      const action = input.action as string;

      if (action === 'status') return textResult(gitStatus());
      if (action === 'diff') return textResult(gitDiff(input.target as string | undefined, input.staged as boolean | undefined));
      if (action === 'log') return textResult(gitLog((input.count as number) || 10));

      if (action === 'add') {
        if (!input.files) return errorResult('add requires files parameter.');
        return textResult(gitAdd(input.files as string));
      }
      if (action === 'remove') {
        if (!input.files) return errorResult('remove requires files parameter.');
        return textResult(gitRemove(input.files as string));
      }
      if (action === 'commit') {
        if (!input.message) return errorResult('commit requires message parameter.');
        return textResult(gitCommit(input.message as string, input.files as string | undefined));
      }
      if (action === 'amend') {
        return textResult(gitAmend(input.message as string | undefined));
      }

      if (action === 'stash') return textResult(gitStash(false, input.message as string | undefined));
      if (action === 'stash_pop') return textResult(gitStash(true));
      if (action === 'stash_list') return textResult(gitStashList());

      if (action === 'switch') {
        if (!input.target) return errorResult('switch requires target branch name.');
        return textResult(gitSwitch(input.target as string, input.create as boolean | undefined));
      }
      if (action === 'branch_list') return textResult(gitBranchList(input.all as boolean | undefined));

      if (action === 'merge_to') {
        if (!input.target) return errorResult('merge_to requires target branch name.');
        return textResult(mergeTo(input.target as string));
      }

      if (action === 'pull') return textResult(gitPull());
      if (action === 'pull_rebase') return textResult(pullRebase());
      if (action === 'push') return textResult(gitPush(input.force as boolean | undefined));

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

      if (action === 'tag') return textResult(gitTag(input.target as string | undefined, input.delete as boolean | undefined));
      if (action === 'show') {
        const ref = (input.commit as string) || (input.target as string) || 'HEAD';
        return textResult(gitShow(ref));
      }

      if (action === 'fetch') return textResult(gitFetch());
      if (action === 'branch_cleanup') return textResult(branchCleanup());

      return errorResult('Unknown action.');
    },
  );
}
