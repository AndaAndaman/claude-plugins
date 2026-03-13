import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { git, currentBranch } from '../shared/git-helper.js';

/**
 * git_ship: Combined commit + push + optional merge workflow.
 * Replaces 3-5 sequential git_command calls with 1 MCP call.
 */
export function registerGitShipTool(server: McpServer): void {
  defineTool(
    server,
    'git_ship',
    'Commit, push, and optionally merge to target branch — all in one call. Replaces sequential git_command calls. Example: {message: "feat: add feature", files: "src/foo.ts", push: true, merge_to: "a-staging"}',
    {
      message: z.string().describe('Commit message'),
      files: z.string().optional().describe('Files to stage (comma/space separated). If omitted, commits already-staged changes'),
      push: z.boolean().optional().describe('Push after commit (default: true)'),
      merge_to: z.string().optional().describe('Branch to merge into after push (e.g. "a-staging"). Auto-pushes target branch'),
      force: z.boolean().optional().describe('Force push with lease (default: false)'),
    },
    async (input) => {
      const message = input.message as string;
      const files = input.files as string | undefined;
      const shouldPush = (input.push as boolean) ?? true;
      const mergeTo = input.merge_to as string | undefined;
      const force = (input.force as boolean) ?? false;

      const branch = currentBranch();
      if (!branch) return errorResult('Not on a branch (detached HEAD).');

      const lines: string[] = [`Branch: ${branch}`];

      // Step 1: Stage files if provided
      if (files) {
        const paths = files.split(/[,\s]+/).filter(Boolean);
        for (const p of paths) {
          const result = git('add', p);
          if (!result.ok) return errorResult(`Failed to stage ${p}: ${result.stderr}`);
        }
        lines.push(`Staged: ${paths.join(', ')}`);
      }

      // Step 2: Check there's something to commit
      const { stdout: staged } = git('diff', '--cached', '--stat');
      if (!staged) return errorResult('Nothing to commit (no staged changes).');

      // Step 3: Commit
      const commitResult = git('commit', '-m', message);
      if (!commitResult.ok) return errorResult(`Commit failed: ${commitResult.stderr}`);
      const { stdout: logLine } = git('log', '-1', '--oneline');
      lines.push(`Committed: ${logLine}`);

      // Step 4: Push
      if (shouldPush || mergeTo) {
        const pushArgs = ['push', '-u', 'origin', branch];
        if (force) pushArgs.splice(1, 0, '--force-with-lease');
        const pushResult = git(...pushArgs);
        if (!pushResult.ok) return errorResult(`Push failed: ${pushResult.stderr}\nCommit was created locally.`);
        lines.push(`Pushed to origin/${branch}`);
      }

      // Step 5: Merge to target branch
      if (mergeTo) {
        if (branch === mergeTo) {
          lines.push(`Skip merge: already on ${mergeTo}`);
        } else {
          const checkout = git('checkout', mergeTo);
          if (!checkout.ok) {
            lines.push(`Merge skipped: cannot switch to ${mergeTo}: ${checkout.stderr}`);
            return textResult(lines.join('\n'));
          }

          const pull = git('pull', '--ff-only');
          if (pull.ok) lines.push(`Pulled latest ${mergeTo}`);

          const merge = git('merge', branch, '--no-edit');
          if (!merge.ok) {
            git('merge', '--abort');
            git('checkout', branch);
            lines.push(`Merge conflict! Aborted and returned to ${branch}`);
            return textResult(lines.join('\n'));
          }

          const targetPush = git('push', '-u', 'origin', mergeTo);
          if (!targetPush.ok) {
            lines.push(`Merged locally but push failed: ${targetPush.stderr}`);
          } else {
            lines.push(`Merged ${branch} → ${mergeTo} and pushed`);
          }

          git('checkout', branch);
          lines.push(`Switched back to ${branch}`);
        }
      }

      return textResult(lines.join('\n'));
    },
  );
}
