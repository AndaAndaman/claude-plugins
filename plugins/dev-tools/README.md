# dev-tools Plugin

AWS ECS tools exposed as MCP tools for Claude Code — list, scale, and manage ECS services without leaving your editor.

## Overview

The dev-tools plugin converts AWS CLI operations into MCP tools that Claude can call directly. Instead of switching to a terminal and remembering CLI flags, you can ask Claude to check service status or scale down your sandbox environment in natural language.

Services are discovered via AWS resource tags (`acc-sandbox`), so you can manage entire environments with a single command.

## Prerequisites

- **AWS CLI** installed and on your PATH: `aws --version`
- **AWS profile `basic_profile`** configured in `~/.aws/credentials` or `~/.aws/config`
- **ECS services tagged** with key `acc-sandbox` and appropriate values (e.g. `core`, `profile`, `report`, `doc`, `ui`, `my`)

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

### Project-Specific Installation

```bash
cp -r ./plugins/dev-tools /path/to/your/project/.claude/
```

### Zero-Setup Note

`dist/server.js` is pre-bundled — users do **not** need yarn or npm. Node.js is the only runtime requirement.

### Verify Installation

```bash
claude
/mcp
# You should see: dev-tools (with 3 tools)
```

## Available Tools

### `aws_ecs_list`

Lists all ECS services matching a tag, grouped by cluster. Shows desired count, running count, and status for each service.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tagValue` | string | No | Tag value to filter by (default: `core,profile,report,doc,ui,my`) |

**Example usage:**
```
"List all my sandbox ECS services"
"Show ECS services tagged with core"
"What's the current status of my ECS services?"
```

**Example output:**
```
Fetching ECS services with tag acc-sandbox=core,profile,report,doc,ui,my...

Cluster: sandbox-cluster
---------------------------------------------------------------------------
| Service          | Desired | Running | Status  |
|------------------|---------|---------|---------|
| core-api         |    1    |    1    | ACTIVE  |
| profile-service  |    0    |    0    | ACTIVE  |
```

---

### `aws_ecs_scale`

Scales **all** ECS services matching a tag to `desiredCount=1`. Useful for spinning up a full sandbox environment in one step.

Has a **confirm gate** — defaults to preview mode. Set `confirm=true` to actually execute.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tagValue` | string | No | Tag value to filter by (default: `core,profile,report,doc,ui,my`) |
| `confirm` | boolean | No | Set `true` to execute (default: `false` = preview only) |

**Example usage:**
```
"Scale up all my sandbox services"
"Show me what aws_ecs_scale would do before I confirm"
"Scale ECS services tagged with core to 1"
```

---

### `aws_ecs_update_service`

Updates the desired count for a **single** ECS service. Use this when you need precise control over one service rather than a bulk operation.

Has a **confirm gate** — defaults to preview mode. Set `confirm=true` to actually execute.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cluster` | string | Yes | ECS cluster name |
| `service` | string | Yes | ECS service name |
| `desiredCount` | number | Yes | New desired count (integer >= 0) |
| `confirm` | boolean | No | Set `true` to execute (default: `false` = preview only) |

**Example usage:**
```
"Scale the core-api service in sandbox-cluster to 2"
"Set the report service desired count to 0 to save costs"
"Update service profile-service in cluster sandbox-cluster to desired count 1"
```

## Configuration

The tools use these hardcoded defaults (defined in source):

| Constant | Value | Description |
|----------|-------|-------------|
| `TAG_KEY` | `acc-sandbox` | Tag key used to identify managed ECS services |
| `DEFAULT_TAG_VALUE` | `core,profile,report,doc,ui,my` | Default comma-separated tag values |
| `AWS_PROFILE` | `basic_profile` | AWS CLI profile used for all ECS commands |

To target a different subset of services, pass a custom `tagValue` to any tool — e.g. `"core"` for only core services.

## Development

### Build from Source

```bash
cd plugins/dev-tools
yarn install
yarn build:bundle   # bundles everything into dist/server.js
```

### Build Scripts

| Script | Description |
|--------|-------------|
| `yarn build` | Bundle with `@modelcontextprotocol/sdk` as external dependency |
| `yarn build:bundle` | Fully self-contained bundle — no runtime dependencies needed |

### Project Structure

```
dev-tools/
├── .claude-plugin/
│   └── plugin.json       # Plugin metadata
├── .mcp.json             # MCP server config for local testing
├── src/
│   ├── main.ts           # MCP server entry point
│   └── tools/
│       ├── index.ts               # Registers all tools
│       ├── ecs-list.tool.ts       # aws_ecs_list
│       ├── ecs-scale.tool.ts      # aws_ecs_scale
│       └── ecs-update-service.tool.ts  # aws_ecs_update_service
├── dist/
│   └── server.js         # Pre-bundled output (committed)
├── package.json
├── tsconfig.json
└── yarn.lock
```

## Troubleshooting

**MCP server not starting:**
- Verify Node.js 18+ is installed: `node --version`
- Check `dist/server.js` exists and is non-empty: `ls -lh dist/server.js`
- Confirm the server appears in `/mcp` output

**AWS CLI errors / no credentials:**
- Verify `basic_profile` is configured: `aws sts get-caller-identity --profile basic_profile`
- Check AWS credentials are not expired

**No services found:**
- Confirm your ECS services have the `acc-sandbox` tag set
- Verify the `tagValue` matches your tag values exactly
- Test the underlying query: `aws resourcegroupstaggingapi get-resources --resource-type-filters "ecs:service" --tag-filters "Key=acc-sandbox,Values=core" --output text --profile basic_profile`

**Scale operation not working:**
- Remember to set `confirm=true` — the default is preview mode
- Check that the AWS profile has `ecs:UpdateService` permissions

## License

MIT

## Contributing

Issues and contributions welcome at https://github.com/AndaAndaman/claude-plugins
