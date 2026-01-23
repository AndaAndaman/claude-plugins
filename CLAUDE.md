# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Claude Code plugin marketplace repository containing productivity plugins for FlowAccount developers. The repository hosts two production plugins that enhance the Claude Code development workflow:

1. **ask-before-code** (v0.1.1) - Prevents wasted development by enforcing requirement clarity
2. **quick-wins** (v0.1.1) - Maintains code quality through systematic easy improvements

## Official Documentation References

**IMPORTANT:** Before making changes to plugin components (especially hooks, agents, or plugin.json files), ALWAYS consult the official Claude Code documentation for the latest specifications and schemas:

- **Plugins Reference:** https://code.claude.com/docs/en/plugins-reference.md
  - Plugin structure and component definitions
  - Agent, command, skill, and hook specifications
  - YAML frontmatter schemas and required fields

- **Hooks Reference:** https://code.claude.com/docs/en/hooks.md
  - Hook types (PreToolUse, PostToolUse, Stop, SessionStart, etc.)
  - Hook response schemas (CRITICAL: must return `{"ok": boolean}`)
  - Prompt-based hooks vs bash hooks
  - Available hook matchers and variables

The official documentation is the authoritative source for:
- Current hook response formats and schemas
- Supported hook events and their contexts
- Agent/command frontmatter requirements
- Plugin.json structure and fields
- Best practices and examples

This CLAUDE.md file provides repository-specific context, but defer to official docs for API specifications and schemas.

## Repository Structure

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace configuration
├── plugins/
│   ├── ask-before-code/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json       # Plugin metadata
│   │   ├── agents/
│   │   │   └── clarity-guardian.md
│   │   ├── commands/
│   │   │   └── clarify.md
│   │   ├── hooks/
│   │   │   └── hooks.json        # PreToolUse hook (Write/Edit)
│   │   └── skills/
│   │       └── request-clarification/
│   └── quick-wins/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── agents/
│       │   └── quick-wins-scanner.md
│       ├── commands/
│       │   ├── quick-wins.md
│       │   └── apply-win.md
│       ├── hooks/
│       │   └── hooks.json        # Stop hook
│       └── skills/
│           ├── code-quality-checks/
│           └── refactoring-patterns/
└── README.md
```

## Plugin Architecture

### ask-before-code Plugin

**Purpose:** Enforces requirement clarity before coding to prevent wasted development effort.

**Components:**
- **Clarity Guardian Agent** - Autonomous agent that detects vague requests and triggers clarification
- **/clarify Command** - Manual requirement gathering with optional topic parameter
- **PreToolUse Hook** - Blocks Write/Edit tools when requirements unclear (uses prompt-based evaluation)
- **request-clarification Skill** - Core methodology for systematic requirement gathering

**Hook Response Format:**
- Hooks must return `{"ok": true}` to allow or `{"ok": false, "systemMessage": "..."}` to block
- PreToolUse hook evaluates requirement clarity checklist (60% threshold for warning, 80% for pass)
- Smart exceptions: Always allows docs, tests, config files, typo fixes, formatting changes

**Key Files:**
- `plugins/ask-before-code/hooks/hooks.json` - Contains prompt-based PreToolUse hook logic
- `plugins/ask-before-code/agents/clarity-guardian.md` - Agent frontmatter and system prompt

### quick-wins Plugin

**Purpose:** Identifies and applies 1-5 minute code improvements to maintain quality and prevent technical debt.

**Components:**
- **Quick Wins Scanner Agent** - Autonomous agent that scans for easy improvements after task completion
- **/quick-wins Command** - Scans specified files/directories for improvement opportunities
- **/apply-win Command** - Applies specific improvements with confirmation
- **Stop Hook** - Triggers quick wins scan after significant code changes
- **code-quality-checks Skill** - Defines what constitutes a "quick win"
- **refactoring-patterns Skill** - Contains TypeScript/Angular/.NET refactoring patterns with before/after examples

**Technology Support:**
- TypeScript/JavaScript (modern syntax, async patterns, type safety)
- Angular (components, services, RxJS, change detection, lifecycle hooks)
- .NET/C# (async/await, LINQ, modern C# features, resource management)

**FlowAccount Integration:**
- Respects FlowAccount naming conventions (`_underscore` prefix for private fields)
- Compatible with Clean Architecture layers (Controller → Facade → Logic → Service → DataHandler)
- Honors Nx project boundaries and DDD structure
- Preserves `flowaccount` component prefix conventions

**Key Files:**
- `plugins/quick-wins/hooks/hooks.json` - Stop hook that triggers after code changes
- `plugins/quick-wins/agents/quick-wins-scanner.md` - Agent that performs quality scanning
- `plugins/quick-wins/skills/refactoring-patterns/references/` - Language-specific pattern libraries

## Development Workflow

### Testing Plugins Locally

```bash
# Test a plugin temporarily (doesn't install)
claude --plugin-dir ./plugins/ask-before-code

# Install globally for all projects
cp -r plugins/ask-before-code ~/.claude-plugins/

# Install locally to a project
cp -r plugins/ask-before-code /path/to/project/.claude/
```

### Modifying Plugins

When editing plugin components:

1. **Agent files** (`agents/*.md`) - YAML frontmatter + markdown system prompt
   - Frontmatter: name, description, capabilities, trigger_patterns, tools, model, color
   - Body: System prompt for the agent

2. **Command files** (`commands/*.md`) - YAML frontmatter + markdown instructions
   - Frontmatter: description, arguments (optional)
   - Body: Instructions for executing the command

3. **Hook files** (`hooks/hooks.json`) - JSON configuration
   - Hooks can be bash commands or prompt-based (LLM evaluation)
   - Must return `{"ok": boolean, "systemMessage"?: string}`
   - PreToolUse hooks: Execute before tools (Write, Edit, Bash, etc.)
   - Stop hooks: Execute when task completes or user stops

4. **Skill files** (`skills/*/SKILL.md`) - Markdown knowledge base
   - Progressive disclosure format (overview → details → examples)
   - Skills provide context and methodology to agents/commands

### Hook Response Schema

**CRITICAL:** All hooks must return JSON with `ok` field:

```json
// Allow the action
{"ok": true}

// Block the action with message
{"ok": false, "systemMessage": "Explanation for user"}
```

**Common Mistake:** Do NOT return `hookSpecificOutput` or `permissionDecision` - these are invalid and will cause schema validation errors.

**Reference:** Always check https://code.claude.com/docs/en/hooks.md for the current hook response schema specification.

### Version Management

Plugin versions are stored in:
- `plugins/{plugin-name}/.claude-plugin/plugin.json` - Individual plugin version
- `.claude-plugin/marketplace.json` - Marketplace catalog with all plugin versions

When bumping versions, update both files to keep them synchronized.

## Marketplace Configuration

The marketplace is configured in `.claude-plugin/marketplace.json`:
- Marketplace name: `flowaccount-dev-tools`
- Owner: Andaman N. (andaman_n@flowaccount.com)
- Repository: https://github.com/AndaAndaman/claude-plugins

To add this marketplace to Claude Code:
```bash
/plugin marketplace add AndaAndaman/claude-plugins
```

## Git Configuration

The repository uses selective CLAUDE.md tracking:
- Root `CLAUDE.md` is **tracked** (this file)
- All subdirectory `CLAUDE.md` files are **ignored** (used for local context)

`.gitignore` pattern:
```gitignore
**/CLAUDE.md    # Ignore all CLAUDE.md in subdirectories
!/CLAUDE.md     # But keep the root one
```

## FlowAccount Context

These plugins are specifically designed for FlowAccount development workflows:

**ask-before-code:**
- Prevents common requirement gaps in Thai accounting domain features
- Understands FlowAccount's DDD architecture and bounded contexts
- Integrates with team's clarification workflow

**quick-wins:**
- Fully compatible with `flowaccount.workspace` (TypeScript/Angular/Nx)
- Fully compatible with `flowaccount.dotnet.workspace` (.NET/C#)
- Works alongside MCP agents (software-engineer, architect, security-scanner)
- Respects FlowAccount coding conventions and architecture patterns

## Key Concepts

### Plugin Components Hierarchy

1. **Commands** - User-invocable slash commands (`/clarify`, `/quick-wins`)
2. **Agents** - Autonomous subprocesses with specialized tools and context
3. **Hooks** - Event-driven automation (PreToolUse, PostToolUse, Stop, SessionStart, etc.)
4. **Skills** - Reusable knowledge bases and methodologies

### Prompt-Based Hooks

Both plugins use advanced prompt-based hooks (not bash scripts):
- Hooks execute an LLM with conversation context and specific prompt
- LLM evaluates whether to allow/block the action
- Enables intelligent decision-making (e.g., "are requirements clear?", "should we scan for improvements?")
- Timeout: 10000ms for hook evaluation

### Tool Access Patterns

- **Agents** have explicit tool lists in frontmatter (e.g., `tools: ["Read", "Grep", "Glob", "Bash"]`)
- **Commands** inherit standard tool access
- **Hooks** (prompt-based) operate with conversation context only

## Testing Hooks

When testing hook modifications:

1. **Verify against official docs** - Check https://code.claude.com/docs/en/hooks.md for current schema
2. Make changes to `hooks/hooks.json`
3. Reload Claude Code or restart session
4. Trigger the hook condition:
   - PreToolUse:Edit - Try editing a file
   - Stop - Complete a task or type stop
5. Check for schema validation errors in output
6. Verify hook response format is correct

Common issues:
- Missing `ok` field → Schema validation error
- Wrong field names (`hookSpecificOutput`, `permissionDecision`) → Invalid response
- Malformed JSON in systemMessage → Parse error
- Incorrect hook event name → Hook never triggers

**If you encounter schema validation errors:** Consult https://code.claude.com/docs/en/hooks.md to verify the expected response format hasn't changed.
