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
/plugin install feature-sprint@flowaccount-dev-tools
/plugin install dev-tools@flowaccount-dev-tools
```

Or test temporarily:
```bash
claude --plugin-dir ./plugins/md-to-skill
```

## Plugins

---

### ask-before-code (v0.4.2)

**Problem:** Developers start coding before fully understanding the requirements. Hours get wasted building the wrong thing, then reworking it after clarification.

**Solution:** Catches vague or incomplete requests early and gathers what's missing through structured questions — before any code gets written.

**How it works:**

The Clarity Guardian agent monitors your conversation. When it detects a request missing essential context (target module, affected users, success criteria, edge cases), it steps in with focused questions. You stay in control — skip clarification when context is already clear.

**Commands:**
- `/clarify [topic]` — Gather requirements with interactive Q&A. Identifies request type (feature/bug/improvement), checks for gaps, asks 2-3 targeted questions, then outputs a confirmed action plan with acceptance criteria.

**Components:**
| Component | Role |
|-----------|------|
| Clarity Guardian agent | Detects vague requests, triggers proactively |
| `/clarify` command | Manual requirement gathering |
| request-clarification skill | Core methodology for systematic question design |

---

### quick-wins (v0.3.5)

**Problem:** Small code quality issues accumulate silently — unused imports, `any` types, missing error handling, outdated syntax. Each one is trivial alone, but together they become technical debt that slows the team down.

**Solution:** Automatically identifies 1-5 minute improvements after you finish a task, right when the code is fresh in your mind.

**How it works:**

A Stop hook fires when you complete a task. It evaluates whether a quality scan would be useful (skips trivial changes or urgent fixes). When triggered, the Quick Wins Scanner agent reads the affected files and produces a prioritized list of improvements with effort estimates.

**Commands:**
- `/quick-wins [path]` — Scan files or directories for improvement opportunities. Returns a ranked list with categories (type safety, modern syntax, error handling, code organization) and estimated fix time.
- `/apply-win [description]` — Apply a specific improvement. Shows before/after diff for confirmation before making changes.

**Technology coverage:**

| Stack | What it catches |
|-------|----------------|
| TypeScript/JavaScript | Missing types, `any` usage, arrow functions, optional chaining, async/await patterns |
| Angular | OnPush change detection, lifecycle hook order, RxJS operator choices, template improvements |
| .NET/C# | Async patterns, LINQ opportunities, resource management, modern C# syntax |

**Components:**
| Component | Role |
|-----------|------|
| Quick Wins Scanner agent | Scans code and produces prioritized improvement list |
| `/quick-wins` command | On-demand scanning |
| `/apply-win` command | Apply individual improvements with preview |
| Stop hook | Triggers scan after task completion |
| code-quality-checks skill | Defines what qualifies as a "quick win" |
| refactoring-patterns skill | Before/after examples for TypeScript, Angular, .NET |

---

### md-to-skill (v0.8.7)

**Problem:** Valuable markdown content — LLM exports, documentation, architecture decisions — sits in files that Claude never sees. Meanwhile, the skill system provides a structured way to give Claude reusable knowledge, but creating skills manually is tedious.

**Solution:** Converts markdown files into organized Claude skills, with a Stop hook that automatically detects high-confidence skill candidates using multi-signal confidence scoring.

**How it works:**

When a session ends, the Stop hook scans for new markdown files written during the session. Each file is scored across 6 signals (instructional language, heading structure, content depth, code blocks, sections, lists) to produce a confidence score. Files scoring above threshold are suggested for conversion. The conversion pipeline analyzes structure, extracts code blocks, splits topics into references, generates frontmatter, and validates quality.

**Commands:**

| Command | Purpose |
|---------|---------|
| `/convert-to-skill <file>` | Convert a markdown file directly into a skill |
| `/learn-skill [dir]` | Batch scan directory for skill candidates |
| `/skill-shopping [task]` | Recommend relevant installed skills for your current task |

**Components:**
| Component | Role |
|-----------|------|
| skill-builder agent | Converts markdown into skill structure |
| Stop hook (md-watch) | Scores new markdown files using 6 weighted signals |
| markdown-parsing skill | Techniques for parsing markdown structure |
| skill-structure-patterns skill | Templates and best practices for skill creation |

---

### feature-sprint (v0.8.2)

**Problem:** Feature implementation either gets under-planned (jump in, hit issues, rework) or over-planned (spend hours on architecture documents nobody reads). The right amount of planning depends on the feature's size, but developers have to make that judgment call themselves.

**Solution:** A PM agent assesses scope first, then routes to the right-sized workflow automatically — from direct one-line fixes to full parallel team execution with code review.

**How it works:**

The PM agent searches the codebase to count affected files and modules, then classifies the feature as tiny/small/medium/large/huge. Each scope level gets a different workflow:

| Scope | Affected | Workflow | Agents |
|-------|----------|----------|--------|
| **Tiny** | 1 file, simple change | Lead fixes directly | None |
| **Small** | 1-2 files | Single implementer | 1 implementer |
| **Medium** | 2-3 files | Scout finds location, then implementer | Scout + 1 implementer |
| **Large** | 4+ files, cross-module | Full analysis, parallel implementers, code review | Scout + Guard + Tester + 2-3 implementers + Reviewer |
| **Huge** | System-wide | Decomposition suggestions, no implementation | PM only (warns and stops) |

**Commands:**
- `/sprint <feature>` — Full-lifecycle development. PM assesses scope, user confirms routing, then agents execute the appropriate workflow.
- `/sprint-plan <feature>` — Plan only. Produces an implementation brief without writing any code.
- `/sprint-loop <goal>` — Long-lived development session. Agents stay alive and accumulate context across iterations. User says "done" to teardown.

**Agents:**

| Agent | Role |
|-------|------|
| PM | Searches codebase, counts affected files/modules, classifies scope |
| Scout | Finds target files, identifies patterns to follow, locates related code |
| Guard | Identifies risks, edge cases, and gotchas that could break the feature |
| Tester | Defines minimum viable test strategy |
| Implementer | Executes a work package with exclusive file ownership (2-3 run in parallel for large scope) |
| Reviewer | Reviews all implementers' code against the brief, checks risk mitigations applied |

---

### dev-tools (v0.9.6)

**Problem:** Switching between editor and terminal to manage AWS services, trigger Jenkins builds, or refresh SSO credentials breaks flow and requires remembering CLI flags.

**Solution:** Exposes AWS ECS, SSO, Jenkins CI, Git, and Healthcheck operations as MCP tools that Claude can call directly in natural language.

**How it works:**

An MCP server provides 16 tools organized by domain. Services are discovered via AWS resource tags, Jenkins targets are configurable per environment (staging/preprod with independent parameter schemas), and all destructive operations have confirm gates (preview by default).

**Tools:**

| Domain | Tools | What they do |
|--------|-------|-------------|
| AWS ECS | `aws_ecs_list`, `aws_ecs_scale`, `aws_ecs_update_service` | List/scale/update ECS services by tag |
| AWS SSO | `aws_sso_status`, `aws_sso_refresh` | Check SSO token expiry, refresh credentials |
| AWS Config | `aws_configure` | View/change AWS profile and tag settings |
| Jenkins | `jenkins_configure`, `jenkins_list_targets`, `jenkins_build`, `jenkins_status`, `jenkins_abort`, `jenkins_edit_config` | Configure, trigger, monitor, and abort CI builds |
| Git | `git_command` | status, stash/pop, switch/create branch, merge_to, pull_rebase, rebase, cherry_pick, reset_soft, fetch, log, branch_cleanup |
| Git Worktree | `git_worktree` | Create, list, remove, and prune worktrees |
| Healthcheck | `healthcheck` | Check health of configured endpoints, manage endpoint list |

---

## Plugin Status

| Plugin | Version | Commands | Agents | Hooks |
|--------|---------|----------|--------|-------|
| ask-before-code | 0.4.2 | 1 | 1 | 1 (SessionStart) |
| quick-wins | 0.3.5 | 2 | 1 | 2 (SessionStart, Stop) |
| md-to-skill | 0.8.7 | 3 | 1 | 1 (Stop) |
| feature-sprint | 0.8.2 | 3 | 7 | 1 (SessionStart) |
| dev-tools | 0.9.6 | 0 | 0 | 1 (SessionStart) |

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
