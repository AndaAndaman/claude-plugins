import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { git } from '../shared/git-helper.js';

function worktreeAdd(path: string, branch?: string, newBranch?: boolean): string {
  const args = ['worktree', 'add'];
  if (newBranch && branch) {
    args.push('-b', branch, path);
  } else if (branch) {
    args.push(path, branch);
  } else {
    args.push(path);
  }

  const result = git(...args);
  if (!result.ok) return `Error: ${result.stderr}`;

  // Show result
  const list = git('worktree', 'list', '--porcelain');
  const entry = list.stdout.split('\n\n').find(e => e.includes(path.replace(/\\/g, '/')));
  return result.stderr || result.stdout || `Worktree created at ${path}`;
}

function worktreeList(): string {
  const result = git('worktree', 'list');
  if (!result.ok) return `Error: ${result.stderr}`;
  if (!result.stdout) return 'No worktrees.';

  const lines = result.stdout.split('\n');
  const out: string[] = [`${lines.length} worktree(s):`];
  for (const line of lines) {
    out.push(`  ${line}`);
  }
  return out.join('\n');
}

function worktreeRemove(path: string, force?: boolean): string {
  const args = ['worktree', 'remove'];
  if (force) args.push('--force');
  args.push(path);

  const result = git(...args);
  if (!result.ok) return `Error: ${result.stderr}`;
  return `Removed worktree: ${path}`;
}

function worktreePrune(): string {
  const before = git('worktree', 'list');
  const beforeCount = before.stdout ? before.stdout.split('\n').length : 0;

  const result = git('worktree', 'prune');
  if (!result.ok) return `Error: ${result.stderr}`;

  const after = git('worktree', 'list');
  const afterCount = after.stdout ? after.stdout.split('\n').length : 0;
  const pruned = beforeCount - afterCount;

  return pruned > 0
    ? `Pruned ${pruned} stale worktree(s). ${afterCount} remaining.`
    : `No stale worktrees. ${afterCount} active.`;
}

export function registerGitWorktreeTool(server: McpServer): void {
  defineTool(
    server,
    'git_worktree',
    'Git worktree management: add (create worktree), list (show all), remove (delete worktree), prune (clean stale refs).',
    {
      action: z.enum(['add', 'list', 'remove', 'prune']).describe(
        'add=create new worktree, list=show all worktrees, remove=delete a worktree, prune=clean stale references'
      ),
      path: z.string().optional().describe('Worktree directory path (required for add/remove)'),
      branch: z.string().optional().describe('Branch name for add (existing branch or new with new_branch=true)'),
      new_branch: z.boolean().optional().describe('Create a new branch when adding worktree (default: false)'),
      force: z.boolean().optional().describe('Force removal even with uncommitted changes (default: false)'),
    },
    async (input) => {
      const action = input.action as string;

      if (action === 'add') {
        if (!input.path) return errorResult('add requires path.');
        return textResult(worktreeAdd(
          input.path as string,
          input.branch as string | undefined,
          input.new_branch as boolean | undefined,
        ));
      }

      if (action === 'list') {
        return textResult(worktreeList());
      }

      if (action === 'remove') {
        if (!input.path) return errorResult('remove requires path.');
        return textResult(worktreeRemove(input.path as string, input.force as boolean | undefined));
      }

      if (action === 'prune') {
        return textResult(worktreePrune());
      }

      return errorResult('Unknown action.');
    },
  );
}
