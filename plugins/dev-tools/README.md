# dev-tools

Developer workflow tools plugin for Claude Code. Provides MCP tools for common GitHub operations.

## What it does

Exposes developer utilities as MCP tools that Claude can call directly during coding sessions. Currently provides PR creation (mock implementation — real GitHub API integration planned).

Built with TypeScript and bundled via esbuild for zero-setup deployment (no `yarn install` required when using the pre-built `dist/server.js`).

## Installation

```bash
# Install locally to a project
cp -r plugins/dev-tools /path/to/project/.claude/

# Test temporarily
claude --plugin-dir ./plugins/dev-tools

# Add via marketplace
/plugin marketplace add AndaAndaman/claude-plugins
/plugin install dev-tools
```

## Building from source

Requires Node.js 18+.

```bash
cd plugins/dev-tools
yarn install
yarn build      # outputs dist/server.js
```

## MCP Tools

### `create_pr`

Creates a pull request on GitHub.

**Parameters:**
- `title` (string, required) — Title of the pull request
- `branch` (string, required) — Source branch for the pull request

**Returns:**
```json
{
  "pr_url": "https://github.com/example/repo/pull/999",
  "status": "mock",
  "title": "your title",
  "branch": "your-branch"
}
```

> Note: The current implementation returns mock data. Real GitHub API integration is planned for a future version.

## Version

0.2.0 — Rewritten in TypeScript with esbuild bundling.
