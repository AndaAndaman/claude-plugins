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

---

### ask-before-code (v0.4.1)

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

### quick-wins (v0.3.4)

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

### md-to-skill (v0.8.4)

**Problem:** Knowledge gets lost between sessions. You discuss business rules, debug tricky issues, make architecture decisions — then next week, Claude starts from zero. The tool-use hooks capture what files you touched, but not what you learned.

**Solution:** A continuous learning engine with two input sources — automatic tool-use observation and manual conversation knowledge extraction — feeding into a single instinct pipeline that grows patterns into reusable skills over time.

**How it works:**

```
Session activity (automatic):
  PostToolUse hooks → observations.jsonl
  Captures: file patterns, edit corrections, command sequences, naming conventions

Conversation knowledge (manual):
  /extract-knowledge → observations.jsonl
  Captures: business rules, domain terms, architecture decisions, debugging insights

Both feed into:
  /observe → instincts (confidence 0.3–0.95)
           → auto-approve at 0.7
           → /evolve clusters 3+ related instincts into full skills
```

Instincts are lightweight learned patterns with confidence scores. They start at 0.3, grow +0.1 per confirming observation, decay over time if not reinforced, and get pruned if they drop below 0.2 or go inactive for 60+ days. When 3+ related instincts in the same domain reach average confidence 0.5+, `/evolve` clusters them into a full Claude skill.

**Commands:**

| Command | Purpose |
|---------|---------|
| `/observe` | Process accumulated observations into instincts. Supports `--auto`, `--patterns` (dry run), `--since`, `--replay` |
| `/extract-knowledge [topic]` | Extract business knowledge from conversation into the instinct pipeline via Python one-liner (correct timestamp/JSON format) |
| `/evolve` | Cluster mature instincts into full skills |
| `/convert-to-skill <file>` | Convert a markdown file directly into a skill |
| `/learn-skill [dir]` | Batch scan directory for skill candidates |
| `/skill-shopping [task]` | Recommend relevant installed skills for your current task |
| `/instinct-status` | View all instincts with confidence, domain, staleness |
| `/instinct-prune` | Remove stale or low-confidence instincts |
| `/instinct-merge` | Combine duplicate instincts |
| `/instinct-reject` | Block an instinct from being suggested again |
| `/instinct-export` | Export instincts to portable JSON |
| `/instinct-import` | Import instincts from another project |
| `/instinct-export-context` | Export auto-approved instincts as CLAUDE.md context |
| `/observe-health` | Check observation pipeline health |
| `/skill-health` | Skill usage analytics and health status |

**Hooks:**

| Hook | Event | What it does |
|------|-------|-------------|
| observe_posttooluse.py | PostToolUse (Write/Edit/Bash/Read) | Records tool-use metadata to observations.jsonl |
| structural_posttooluse.py | PostToolUse (Write/Edit/Bash) | Captures code structure (imports, functions, classes, decorators) |
| instinct-suggest_pretooluse.py | PreToolUse (Write/Edit/Bash/Read) | Suggests relevant auto-approved instincts before tool execution |
| skill_posttooluse.py | PostToolUse (Skill) | Tracks skill usage and reinforces source instincts (+0.02 confidence) |
| md-watch_stop.py | Stop | Detects new markdown files that could become skills |

**Components:**
| Component | Role |
|-----------|------|
| skill-builder agent | Converts markdown/instinct clusters into skill structure |
| learning-observer agent | Deep pattern analysis beyond hook-level detection |
| continuous-learning skill | Documents the instinct lifecycle methodology |
| markdown-parsing skill | Techniques for parsing markdown structure |
| skill-structure-patterns skill | Templates and best practices for skill creation |

---

### local-memory (v0.5.2)

**Problem:** Claude Code loses context about your project structure between sessions. Every new conversation starts without understanding what each directory contains, what patterns exist, or how modules relate to each other.

**Solution:** Automatically generates CLAUDE.md breadcrumb files in subdirectories that describe the module's purpose, files, patterns, and dependencies. These load into Claude's context at session start, giving it immediate understanding of the codebase.

**How it works:**

A Stop hook detects which directories had file changes during the session. It then triggers an MCP-based pipeline: analyze directory contents, generate a context summary, and write/merge it into a CLAUDE.md file. The merge is smart — it preserves any manually written sections while updating the auto-generated blocks.

**Commands:**
- `/build-context [directory]` — Manually trigger context generation for a specific directory or current directory.

**MCP tools (used internally by the context-builder agent):**
- `analyze_directory` — Scan directory structure and file contents
- `generate_context` — Produce structured context summary
- `write_context` — Write or merge CLAUDE.md with existing content
- `list_context_files` — List all generated context files

**Components:**
| Component | Role |
|-----------|------|
| context-builder agent | Orchestrates MCP tools for context generation |
| Stop hook | Detects file changes and triggers context builds |
| directory-summarization skill | Guides how to document module structure |

---

### feature-sprint (v0.5.1)

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

## Plugin Status

| Plugin | Version | Commands | Agents | Hooks |
|--------|---------|----------|--------|-------|
| ask-before-code | 0.4.1 | 1 | 1 | - |
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
