# FlowAccount Dev Tools - Claude Code Plugins

A plugin marketplace for Claude Code with development tools designed for FlowAccount developers.

## Quick Start

```bash
# Add marketplace
/plugin marketplace add AndaAndaman/claude-plugins

# Install plugins
/plugin install ask-before-code@flowaccount-dev-tools
/plugin install quick-wins@flowaccount-dev-tools
/plugin install md-to-skill@flowaccount-dev-tools
/plugin install local-memory@flowaccount-dev-tools
/plugin install feature-sprint@flowaccount-dev-tools
```

Or test temporarily:
```bash
claude --plugin-dir ./plugins/md-to-skill
```

## Plugins

### ask-before-code (v0.4.0)

Encourages requirement clarity before coding.

- `/clarify [topic]` - Gather requirements with interactive Q&A
- **Clarity Guardian agent** - Detects vague requests and triggers clarification
- Works as a helper, not a blocker

### quick-wins (v0.3.4)

Identifies 1-5 minute code improvements to prevent technical debt.

- `/quick-wins [path]` - Scan files for improvement opportunities
- `/apply-win [description]` - Apply a specific improvement
- **Stop hook** - Suggests improvements after task completion
- Supports TypeScript/Angular and .NET/C#

### md-to-skill (v0.8.4)

Continuous learning engine that observes your work and builds knowledge over time.

**Learning pipeline:**
```
Tool use (automatic)     -> observations.jsonl -> /observe -> instincts -> /evolve -> skills
Conversation (manual)    -> /extract-knowledge ----^
```

Key commands:
- `/observe` - Process observations into instincts (learned patterns)
- `/extract-knowledge [topic]` - Capture business knowledge from conversation into the instinct pipeline
- `/evolve` - Cluster mature instincts into full skills
- `/convert-to-skill <file>` - Convert a markdown file into a skill
- `/skill-shopping [task]` - Recommend relevant skills for your current task
- `/instinct-status` - View all instincts with confidence scores
- `/instinct-prune` - Remove stale or low-confidence instincts

Also includes: `/learn-skill`, `/observe-health`, `/skill-health`, `/instinct-export`, `/instinct-import`, `/instinct-merge`, `/instinct-reject`, `/instinct-export-context`

### local-memory (v0.5.2)

Builds subdirectory CLAUDE.md context files automatically using Hook + MCP architecture.

- **Stop hook** - Detects file changes and triggers context generation
- `/build-context [directory]` - Manually build context for a directory
- MCP tools for directory analysis, context generation, and smart merging

### feature-sprint (v0.5.1)

Scope-driven feature development with right-sized workflows.

- `/sprint <feature>` - Full-lifecycle development with scope assessment
- `/sprint-plan <feature>` - Plan only, no implementation
- **PM agent** assesses scope (tiny/small/medium/large/huge)
- Tiny-medium: fast subagents. Large: Agent Teams with parallel implementers and code review
- Includes scout, guard, tester, implementer, and reviewer agents

## Plugin Status

| Plugin | Version | Commands | Agents | Hooks |
|--------|---------|----------|--------|-------|
| ask-before-code | 0.4.0 | 1 | 1 | - |
| quick-wins | 0.3.4 | 2 | 1 | 1 (Stop) |
| md-to-skill | 0.8.4 | 14 | 2 | 5 (Pre/Post/Stop) |
| local-memory | 0.5.2 | 1 | 1 | 1 (Stop) |
| feature-sprint | 0.5.1 | 2 | 6 | - |

## FlowAccount Compatibility

All plugins work with both FlowAccount workspaces:

- **flowaccount.workspace** (TypeScript/Angular/Nx)
- **flowaccount.dotnet.workspace** (.NET/C#)

Respects FlowAccount conventions: `_underscore` prefix, Clean Architecture layers, Nx project boundaries, DDD structure, `flowaccount` component prefix.

## Installation Options

**Marketplace** (recommended):
```bash
/plugin marketplace add AndaAndaman/claude-plugins
/plugin install <plugin-name>@flowaccount-dev-tools
```

**Local to project:**
```bash
cp -r plugins/<plugin-name> /path/to/project/.claude/
```

**Global:**
```bash
cp -r plugins/<plugin-name> ~/.claude-plugins/
```

## Development

```bash
# Test a plugin
claude --plugin-dir ./plugins/<plugin-name>

# Test multiple together
claude --plugin-dir ./plugins/ask-before-code --plugin-dir ./plugins/quick-wins
```

When modifying plugins, keep versions synchronized between `plugins/<name>/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.

## License

MIT - See [LICENSE](LICENSE).
