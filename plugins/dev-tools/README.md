# dev-tools Plugin

AWS, Jenkins, and Git dev tools exposed as MCP tools for Claude Code — ECS management, SSO credentials, Jenkins CI builds, Git workflow shortcuts, and deployment commands.

## Overview

The dev-tools plugin converts CLI operations into MCP tools that Claude can call directly. Instead of switching to a terminal and remembering CLI flags, you can ask Claude to check service status, trigger a build, or refresh credentials in natural language.

## Prerequisites

- **Node.js 18+** installed
- **AWS CLI** installed and on your PATH (for AWS tools)
- **AWS profile** configured in `~/.aws/credentials` or `~/.aws/config`
- **Jenkins** accessible with API token (for Jenkins tools)

## Installation

### Marketplace (Recommended)

```bash
/plugin marketplace add AndaAndaman/claude-plugins
/plugin install dev-tools
```

### Local Plugin (Temporary Testing)

```bash
# From the claude-plugins repository root
claude --plugin-dir ./plugins/dev-tools
```

### User-Wide Installation

```bash
cp -r ./plugins/dev-tools ~/.claude-plugins/
```

### Zero-Setup Note

`dist/devtool.server.js` is pre-bundled — users do **not** need yarn or npm. Node.js is the only runtime requirement.

### Verify Installation

```bash
claude
/mcp
# You should see: dev-tools (with 14 tools)
```

## Commands

### `/deploy [target] [environment]`

Ship current branch to staging or preprod — merge to the environment branch and trigger a Jenkins build in one step.

```bash
/deploy                      # Interactive — asks target + environment
/deploy ui staging           # Merge to a-staging, build UI
/deploy api preprod          # Merge to canary-preprod, build API
```

**What it does:** verify clean tree → merge to env branch → trigger build → monitor status.

### `/build [target] [environment]`

Trigger a Jenkins build without any git operations. Use when the branch is already merged and you just need to rebuild.

```bash
/build                       # Interactive — asks target + environment
/build ui                    # Build UI on staging (default)
/build api preprod           # Build API on preprod
```

## Branch Conventions

The target branch to merge into depends on the build target:

| Target | Staging branch | Preprod branch |
|---|---|---|
| `ui` | `a-staging` | `a-preprod` |
| `api`, `api-report`, `api-doc`, `api-profile`, `open-api` | `canary-staging` | `canary-preprod` |
| `lambda-pdf-preview`, `lambda-pdf-gen` | `a-staging` | `a-preprod` |

## Available Tools

### AWS ECS

#### `aws_ecs_list`

Lists all ECS services matching a tag, grouped by cluster. Shows desired count, running count, and status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tagValue` | string | No | Tag value to filter by (default: configurable) |

#### `aws_ecs_scale`

Scales **all** ECS services matching a tag to `desiredCount=1`. Has a confirm gate — defaults to preview mode.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tagValue` | string | No | Tag value to filter |
| `confirm` | boolean | No | Set `true` to execute (default: preview) |

#### `aws_ecs_update_service`

Updates the desired count for a **single** ECS service. Has a confirm gate.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cluster` | string | Yes | ECS cluster name |
| `service` | string | Yes | ECS service name |
| `desiredCount` | number | Yes | New desired count |
| `confirm` | boolean | No | Set `true` to execute (default: preview) |

---

### AWS SSO

#### `aws_sso_status`

Checks SSO token expiry by reading the local cache file. No API call made — fast and safe to call anytime.

#### `aws_sso_refresh`

Refreshes SSO credentials. Runs `aws sso login` if expired, then exports credentials to the configured profile.

---

### AWS Configuration

#### `aws_configure`

View or change AWS profile, tag key/value settings used by the ECS tools. Persists across the session.

---

### Jenkins CI

#### `jenkins_configure`

Set Jenkins URL, user, API token, and environment (staging/preprod). Must be called before other Jenkins tools.

#### `jenkins_list_targets`

Show available build targets with their default parameters.

#### `jenkins_build`

Trigger a Jenkins build.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target` | string | Yes | Build target: ui, api, api-report, api-doc, api-profile, open-api, lambda-pdf-preview, lambda-pdf-gen |
| `environment` | string | No | `staging` (default) or `preprod` |
| `params` | object | No | Override default build parameters |

#### `jenkins_status`

Check build status and console output for a running or completed build.

#### `jenkins_abort`

Abort/cancel a running build or queued item.

#### `jenkins_edit_config`

View, set, remove, or reset per-target default parameter overrides.

---

### Git

#### `git_command`

Git workflow shortcuts with safety guardrails.

| Action | Parameters | Description |
|--------|-----------|-------------|
| `merge_to` | `target` (required) | Merge current branch → target branch, push, return |
| `pull_rebase` | — | Pull with rebase |
| `rebase` | `target` (default: main) | Rebase current branch onto target |
| `cherry_pick` | `commit` (required) | Cherry-pick a commit |
| `branch_cleanup` | — | Delete all merged branches |

---

### Healthcheck

#### `healthcheck`

Check health of configured endpoints, or manage the endpoint list.

| Action | Description |
|--------|-------------|
| `check` | Run health checks on all configured endpoints |
| `list` | Show configured endpoints |
| `add` | Add a new endpoint |
| `edit` | Edit an existing endpoint |
| `remove` | Remove an endpoint |

---

## Typical Workflows

**Deploy to staging:**
```
/deploy ui staging
```

**Build only (no merge):**
```
/build api preprod
```

**AWS:** `aws_sso_status` → `aws_sso_refresh` (if expired) → `aws_ecs_list` → `aws_ecs_update_service`

**Jenkins manual:** `jenkins_configure` (set token once) → `jenkins_list_targets` → `jenkins_build` → `jenkins_status` → `jenkins_abort` (if needed)

**Git:** `git_command action=merge_to target="a-staging"` → `git_command action=pull_rebase`

## Development

### Build from Source

```bash
cd plugins/dev-tools
npm install
npm run build
```

### Project Structure

```
dev-tools/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── deploy.md              # /deploy command
│   └── build.md               # /build command
├── skills/
│   └── ship-and-build/
│       └── SKILL.md           # Branch conventions + workflow guide
├── hooks/
│   └── hooks.json             # SessionStart hook
├── src/
│   ├── main.ts
│   ├── shared/
│   │   ├── aws.ts
│   │   ├── config.ts
│   │   ├── healthcheck.ts
│   │   ├── jenkins.ts
│   │   ├── mcp-helpers.ts
│   │   └── sso.ts
│   └── tools/
│       ├── index.ts
│       ├── ecs-list.tool.ts
│       ├── ecs-scale.tool.ts
│       ├── ecs-update-service.tool.ts
│       ├── sso-status.tool.ts
│       ├── sso-refresh.tool.ts
│       ├── set-profile.tool.ts
│       ├── jenkins-configure.tool.ts
│       ├── jenkins-list.tool.ts
│       ├── jenkins-build.tool.ts
│       ├── jenkins-status.tool.ts
│       ├── jenkins-abort.tool.ts
│       ├── jenkins-edit-config.tool.ts
│       ├── git-command.tool.ts
│       └── healthcheck.tool.ts
├── dist/
│   └── devtool.server.js
├── package.json
└── tsconfig.json
```

## Troubleshooting

**MCP server not starting:**
- Verify Node.js 18+ is installed: `node --version`
- Check `dist/devtool.server.js` exists
- Confirm the server appears in `/mcp` output

**AWS CLI errors / no credentials:**
- Run `aws_sso_status` to check token expiry
- Run `aws_sso_refresh` to refresh if expired
- Verify profile is configured with `aws_configure`

**Jenkins tools not working:**
- Run `jenkins_configure` first to set URL, user, and token
- Verify Jenkins is accessible from your machine

**Build fails with HTTP 500:**
- Check `jenkins_status` for console output
- Verify target params match actual Jenkins job (see `jenkins_list_targets`)

## License

MIT

## Contributing

Issues and contributions welcome at https://github.com/AndaAndaman/claude-plugins
