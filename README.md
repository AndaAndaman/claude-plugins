# FlowAccount Dev Tools - Claude Code Plugins

A plugin marketplace for Claude Code, built for FlowAccount developers who want to ship faster without cutting corners.

## Quick Start

```bash
# Add the marketplace
/plugin marketplace add AndaAndaman/claude-plugins

# Pick what you need
/plugin install ask-before-code@flowaccount-dev-tools
/plugin install quick-wins@flowaccount-dev-tools
/plugin install md-to-skill@flowaccount-dev-tools
/plugin install feature-sprint@flowaccount-dev-tools
/plugin install dev-tools@flowaccount-dev-tools
```

Want to try before you commit?
```bash
claude --plugin-dir ./plugins/dev-tools
```

## Plugins

---

### ask-before-code (v0.4.2)

Ever spent two hours building a feature only to hear "that's not what I meant"? Yeah, us too.

This plugin catches vague requests early. The Clarity Guardian agent watches your conversation and steps in when something important is missing — target module, who's affected, what "done" looks like. It asks 2-3 focused questions, you align on scope, then you code with confidence.

Not a gatekeeper — a safety net. Skip it when you already know what you're doing.

**Commands:**
- `/clarify [topic]` — Start a quick requirements Q&A. Gets you from "add a report feature" to a clear action plan with acceptance criteria.

---

### quick-wins (v0.3.5)

Small issues pile up quietly — an `any` type here, a missing null check there, some pre-ES2020 syntax nobody updated. Each one takes a minute to fix, but nobody notices them until the codebase feels heavy.

This plugin notices. After you finish a task, a Stop hook evaluates whether a quality scan makes sense (it won't bug you for a one-line config change). When it triggers, the scanner reads your changed files and hands you a prioritized list of 1-5 minute fixes.

**Commands:**
- `/quick-wins [path]` — Scan files for easy improvements. Shows category, effort estimate, and what to fix.
- `/apply-win [description]` — Apply a specific fix with a before/after preview.

**What it catches:** missing types, `any` usage, modern syntax opportunities, error handling gaps, Angular change detection, .NET async patterns, and more across TypeScript, Angular, and .NET/C#.

---

### md-to-skill (v0.8.8)

You've got great markdown sitting around — LLM exports, architecture docs, team playbooks — but Claude never sees it. Meanwhile, Claude's skill system is powerful but nobody wants to hand-craft YAML frontmatter for every piece of knowledge.

This plugin bridges the gap. Point it at a markdown file and it produces a clean Claude skill: frontmatter, progressive disclosure structure, code examples extracted, quality validated. A Stop hook even watches for new markdown files and suggests the best candidates automatically (scored across 6 signals).

**Commands:**
- `/convert-to-skill <file>` — Turn one markdown file into a skill.
- `/learn-skill [dir]` — Batch scan a directory for skill candidates.
- `/skill-shopping [task]` — "What skills do I already have that could help with this?"

---

### feature-sprint (v0.8.2)

Feature work usually goes one of two ways: you jump in and hit unexpected issues, or you spend forever planning before writing a line of code. The right approach depends on the size of the feature — but sizing is its own skill.

This plugin does the sizing for you. A PM agent searches the codebase, counts affected files and modules, and picks the right workflow automatically:

| Scope | What it looks like | What happens |
|-------|-------------------|--------------|
| **Tiny** | 1 file, obvious change | Claude fixes it directly |
| **Small** | 1-2 files | One implementer agent |
| **Medium** | 2-3 files | Scout finds the spot, then implementer builds it |
| **Large** | 4+ files, cross-module | Full team: scout, guard, tester, parallel implementers, code review |
| **Huge** | System-wide | "This is too big — here's how to break it down" |

**Commands:**
- `/sprint <feature>` — Full lifecycle: scope, plan, implement, review.
- `/sprint-plan <feature>` — Just the plan, no code changes.
- `/sprint-loop <goal>` — Long session with agents that stay alive and accumulate context. Say "done" when you're finished.

---

### dev-tools (v0.9.14)

You know the pain: Claude tries to `curl` an API through Bash and the quoting breaks. Or runs `git commit` in a subshell and the message gets mangled. Or you have to spell out AWS CLI flags every single time.

This plugin gives Claude **native MCP tools** for git, HTTP, AWS, Jenkins, and health checks. No Bash, no shell escaping, no silent failures. Claude calls `git`, `curl`, and `aws` binaries directly through Node.js `spawnSync` — typed inputs, structured outputs, every time.

**14 tools across 6 domains:**

| Domain | Tools | Highlights |
|--------|-------|-----------|
| **Git** | `git_command` | 22 actions: status, diff, log, add, remove, commit, amend, push, pull, stash, switch, branch_list, merge_to, rebase, cherry_pick, tag, show, reset_soft, fetch, and more |
| **Git Worktree** | `git_worktree` | Create, list, remove, prune worktrees |
| **HTTP** | `http_request` | GET/POST/PUT/PATCH/DELETE with headers, JSON body, basic auth — replaces Bash curl entirely |
| **AWS ECS** | `aws_ecs` | 11 actions: list_clusters, list_services, search, describe, scale, update, restart, events, tasks, logs, wait |
| **AWS SSO** | `aws_sso_status`, `aws_sso_refresh`, `aws_configure` | Check token expiry, refresh credentials (handles browser login), configure profile |
| **Jenkins** | `jenkins_configure`, `jenkins_list_targets`, `jenkins_build`, `jenkins_status`, `jenkins_abort`, `jenkins_edit_config` | Full CI lifecycle: configure, trigger, monitor, abort |
| **Healthcheck** | `healthcheck` | Check endpoints, manage the endpoint list |

**Commands:**
- `/deploy [target] [env]` — Ship current branch and trigger Jenkins build.
- `/build [target]` — Trigger a Jenkins build without merging.

---

## At a Glance

| Plugin | Version | What it does |
|--------|---------|-------------|
| ask-before-code | 0.4.2 | Catches unclear requirements before you waste time coding |
| quick-wins | 0.3.5 | Finds 1-5 minute code improvements after you finish a task |
| md-to-skill | 0.8.8 | Turns markdown files into Claude skills automatically |
| feature-sprint | 0.8.2 | Right-sizes your workflow from one-liner to full team sprint |
| dev-tools | 0.9.14 | Native MCP tools for git, HTTP, AWS, Jenkins, health checks |

## Works with FlowAccount

All plugins are built for both FlowAccount workspaces:

- **flowaccount.workspace** — TypeScript, Angular, Nx
- **flowaccount.dotnet.workspace** — .NET, C#

Respects your conventions: `_underscore` prefix, Clean Architecture layers, Nx boundaries, DDD structure, `flowaccount` component prefix.

## Installation

**From the marketplace** (recommended):
```bash
/plugin marketplace add AndaAndaman/claude-plugins
/plugin install <plugin-name>@flowaccount-dev-tools
```

**Local to a project:**
```bash
cp -r plugins/<plugin-name> /path/to/project/.claude/
```

**Global (all projects):**
```bash
cp -r plugins/<plugin-name> ~/.claude-plugins/
```

## Development

```bash
# Test a single plugin
claude --plugin-dir ./plugins/<plugin-name>

# Test multiple together
claude --plugin-dir ./plugins/ask-before-code --plugin-dir ./plugins/quick-wins
```

When releasing, keep versions in sync across three files: `plugins/<name>/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and `plugins/<name>/src/main.ts`.

## License

MIT - See [LICENSE](LICENSE).
