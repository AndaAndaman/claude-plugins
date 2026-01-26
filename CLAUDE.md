# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Claude Code plugin marketplace repository containing productivity plugins for FlowAccount developers. The repository hosts three production plugins that enhance the Claude Code development workflow:

1. **ask-before-code** (v0.2.0) - Prevents wasted development by encouraging requirement clarity
2. **quick-wins** (v0.1.3) - Maintains code quality through systematic easy improvements
3. **md-to-skill** (v0.1.1) - Converts markdown files into organized Claude skills

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
│   │   └── skills/
│   │       └── request-clarification/
│   ├── quick-wins/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── agents/
│   │   │   └── quick-wins-scanner.md
│   │   ├── commands/
│   │   │   ├── quick-wins.md
│   │   │   └── apply-win.md
│   │   ├── hooks/
│   │   │   └── hooks.json        # Stop hook
│   │   └── skills/
│   │       ├── code-quality-checks/
│   │       └── refactoring-patterns/
│   └── md-to-skill/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── agents/
│       │   └── skill-builder.md
│       ├── commands/
│       │   ├── convert-to-skill.md
│       │   └── learn-skill.md
│       └── skills/
│           ├── markdown-parsing/
│           └── skill-structure-patterns/
└── README.md
```

## Plugin Architecture

### ask-before-code Plugin

**Purpose:** Encourages requirement clarity before coding to prevent wasted development effort.

**Components:**
- **Clarity Guardian Agent** - Autonomous agent that detects vague requests and triggers clarification
- **/clarify Command** - Manual requirement gathering with optional topic parameter
- **request-clarification Skill** - Core methodology for systematic requirement gathering

**Design Philosophy:**
- **Helper, not blocker** - Provides guidance without enforcing strict rules
- Agent triggers proactively when detecting unclear requirements
- Users maintain control - can skip clarification if context is already clear
- No hooks that block legitimate work

**Key Files:**
- `plugins/ask-before-code/agents/clarity-guardian.md` - Agent frontmatter and system prompt
- `plugins/ask-before-code/commands/clarify.md` - Command implementation
- `plugins/ask-before-code/skills/request-clarification/` - Methodology and examples

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

### md-to-skill Plugin

**Purpose:** Converts markdown files (from LLM exports, documentation, or manual creation) into organized Claude Code skills.

**Components:**
- **skill-builder Agent** - Autonomous agent that analyzes markdown, generates skill structure, and validates quality
- **/convert-to-skill Command** - Converts a single markdown file into a skill
- **/learn-skill Command** - Scans directory for markdown files and batch converts selected files
- **markdown-parsing Skill** - Techniques for parsing markdown structure
- **skill-structure-patterns Skill** - Best practices for Claude skills with templates and examples

**Key Features:**
- Automatic name generation (3 options based on content)
- Progressive disclosure (lean SKILL.md, detailed references/)
- Code block extraction to examples/
- Quality validation and auto-fixes
- Intelligent merging with existing skills
- User/project scope selection

**Key Files:**
- `plugins/md-to-skill/agents/skill-builder.md` - Agent that handles conversion workflow
- `plugins/md-to-skill/commands/convert-to-skill.md` - Single file conversion
- `plugins/md-to-skill/commands/learn-skill.md` - Batch conversion with content analysis
- `plugins/md-to-skill/skills/skill-structure-patterns/` - Templates and examples for skill creation

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
   - Frontmatter: name, description (with `<example>` blocks), model, color, tools
   - Body: System prompt for the agent
   - **IMPORTANT:** Agent descriptions must include `<example>` blocks showing triggering conditions
   - Format: `<example>`, `Context:`, `user:`, `assistant:`, `<commentary>`

2. **Command files** (`commands/*.md`) - YAML frontmatter + markdown instructions
   - Frontmatter: name, description, arguments (optional), allowed-tools
   - Body: Instructions for executing the command
   - Use `Task(agent-name)` syntax to invoke agents (not structured parameters)

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

**md-to-skill:**
- Helps document FlowAccount-specific patterns and knowledge
- Converts team documentation into reusable skills
- Supports both user-wide and project-specific skill installation
- Maintains progressive disclosure for easy skill maintenance

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

## Common Development Tasks

### Testing a Plugin Before Publishing

```bash
# Test plugin in isolation
claude --plugin-dir ./plugins/md-to-skill

# Test multiple plugins together
claude --plugin-dir ./plugins/ask-before-code --plugin-dir ./plugins/quick-wins
```

### Version Synchronization

When releasing a new plugin version:
1. Update `plugins/{plugin-name}/.claude-plugin/plugin.json` - Change `version` field
2. Update `.claude-plugin/marketplace.json` - Change `version` field in plugins array
3. Commit both changes together to keep versions synchronized

### Adding a New Plugin to Marketplace

After creating a new plugin in `plugins/`:
1. Add entry to `.claude-plugin/marketplace.json` in the `plugins` array:
```json
{
  "name": "plugin-name",
  "version": "0.1.0",
  "description": "Brief description",
  "source": "./plugins/plugin-name",
  "author": {
    "name": "FlowAccount Developer",
    "email": "dev@flowaccount.com"
  }
}
```
2. Update README.md to document the new plugin
3. Test with `claude --plugin-dir ./plugins/plugin-name`

## Plugin Component Patterns

### Agent Description Pattern (REQUIRED)

Agent descriptions MUST include `<example>` blocks. This is the official pattern:

```yaml
description: Use this agent when the user asks to "[phrase 1]", "[phrase 2]"... Examples:

  <example>
  Context: Brief context about the scenario
  user: "User's request that triggers the agent"
  assistant: "I'll use the agent-name agent to handle this."
  <commentary>
  Explanation of why the agent should trigger.
  </commentary>
  </example>
```

### Task Tool Invocation Pattern

Commands should invoke agents using simple syntax:
```markdown
Launch the agent to handle this task:

Task(agent-name)
```

**NOT** this (incorrect):
```markdown
Task(
  subagent_type="agent-name",
  description="...",
  prompt="..."
)
```

### Hook Response Pattern

All hooks must return exactly this structure:
```json
{"ok": true}  // Allow the action
{"ok": false, "systemMessage": "Reason"}  // Block the action
```

No other fields (`hookSpecificOutput`, `permissionDecision`) are valid.
