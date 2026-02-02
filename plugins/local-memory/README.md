# local-memory Plugin

Automatically builds subdirectory CLAUDE.md files as context breadcrumbs when working through your codebase.

## Overview

As you work through a large codebase, context about subdirectories and modules can get lost between sessions. This plugin uses a **hybrid Hook + MCP architecture** to automatically create CLAUDE.md files in subdirectories where you've edited 2+ files, capturing:

- **Module overview** - High-level purpose of the directory
- **File summaries** - What each file does (concise, 1-2 sentences)
- **Key patterns** - Coding conventions, architectural patterns, design decisions
- **Dependencies** - How this module relates to other parts of the codebase

The next time Claude reads files in that subdirectory, the CLAUDE.md is automatically loaded as context, enabling faster understanding without re-reading all files.

### Architecture

**Stop Hook** (bash script) → Detects file changes → **Claude** → Uses **MCP Tools** → Creates CLAUDE.md

- **Hook**: Deterministic detection of when context should be built
- **MCP Server**: Python server providing analysis and generation tools
- **Claude**: Orchestrates the workflow using MCP tools

## Features

- **Automatic context building** - Stop hook detects when 2+ files in a directory are modified
- **MCP-powered analysis** - Python MCP server provides powerful directory analysis tools
- **Smart merging** - Updates existing CLAUDE.md files while preserving user-written content
- **Dependency detection** - Automatically analyzes imports/exports to map relationships
- **Configurable** - Per-project settings for thresholds, exclusions, and behavior
- **Proactive & reactive** - Claude can use MCP tools during work OR automatically via hook
- **Respects .gitignore** - Automatically excludes directories that shouldn't be documented

## Prerequisites

**Python 3.8+** is required for both the MCP server and Stop hook:

```bash
pip install mcp
```

**Why Python is needed:**
- **MCP Server**: Runs the context_builder.py MCP server for directory analysis tools
- **Stop Hook**: Hook script uses Python for JSON escaping (check-context-trigger.sh:167)

## Installation

### Local Plugin (Recommended for Testing)

```bash
# From the claude-plugins repository root
claude --plugin-dir ./plugins/local-memory
```

### User-Wide Installation

```bash
cp -r ./plugins/local-memory ~/.claude-plugins/
```

### Project-Specific Installation

```bash
cp -r ./plugins/local-memory /path/to/your/project/.claude/
```

### Verify Installation

After installation, verify the MCP server is running:

```bash
# Start Claude Code
claude

# Check MCP servers
/mcp

# You should see: local-memory (with 4 tools)
```

## Usage

### Automatic Context Building

The plugin works automatically via the Stop hook:

1. Work on your code normally, editing files in a directory
2. When you complete a task or stop Claude, the Stop hook evaluates your session
3. If 2+ files in the same directory were edited, the hook blocks and suggests MCP tools
4. Claude automatically uses the MCP tools to:
   - **analyze_directory**: Scans files, detects language, patterns, imports
   - **generate_context**: Creates CLAUDE.md markdown content
   - **write_context**: Writes/updates the CLAUDE.md file with smart merge
5. Next session, the CLAUDE.md loads automatically when Claude reads files in that directory

### Manual/Proactive Context Building

You can also ask Claude to build context proactively during your session:

```bash
# Ask Claude
"Generate context documentation for src/api"

# Claude will use MCP tools:
# 1. analyze_directory(src/api)
# 2. generate_context(src/api)
# 3. write_context(src/api, content)
```

### View Existing Context Files

```bash
# Ask Claude
"List all CLAUDE.md files in this project"

# Claude uses: list_context_files()
```

## MCP Tools Reference

The local-memory MCP server exposes these tools:

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| `analyze_directory` | Analyze directory structure | directory, project_root | JSON: files, language, patterns, imports |
| `generate_context` | Generate CLAUDE.md content | directory, project_root, max_files | Markdown content |
| `write_context` | Write/update CLAUDE.md | directory, content, smart_merge | Success status & path |
| `list_context_files` | List all CLAUDE.md files | project_root | Array of file paths |

**Tool naming in Claude Code:**
- Full name: `mcp__plugin_local-memory_local-memory__<tool_name>`
- Example: `mcp__plugin_local-memory_local-memory__analyze_directory`

You can ask Claude to use these tools directly:
- "Analyze the src/api directory"
- "Generate context for src/services"
- "Show me all CLAUDE.md files in this project"

## Configuration

Create `.claude/local-memory.local.md` in your project to customize behavior:

```markdown
---
threshold: 2                    # Number of files required to trigger (default: 2)
autoGenerate: true              # Enable automatic context building (default: true)
maxFilesAnalyzed: 50            # Max files to analyze per directory (default: 50)
excludedDirectories:            # Additional directories to exclude
  - temp
  - cache
---

# Local Memory Configuration

This file configures the local-memory plugin for this project.
```

### Default Exclusions

The following directories are always excluded:
- `node_modules`, `vendor`, `packages`
- `.git`, `.svn`, `.hg`
- `dist`, `build`, `out`, `target`
- Any directory matching `.gitignore` patterns

## How It Works

### 1. Stop Hook (Detection)

When Claude finishes a task or the user stops, the Stop hook (command-based bash script):
1. Reads settings from `.claude/local-memory.local.md` (threshold, autoGenerate, exclusions)
2. Analyzes conversation transcript for Edit/Write tool usage
3. Groups modified files by directory (counts files per directory)
4. Applies exclusion rules (node_modules, dist, tests, etc.)
5. For each directory with >= threshold files modified:
   - Returns "block" decision with suggestion
   - Tells Claude which MCP tools to use and how
6. If no directories meet threshold or autoGenerate=false, allows stop

**Script location:** `hooks/scripts/check-context-trigger.sh`
**Hook type:** Command-based (deterministic bash, not LLM-based)

### 2. MCP Server (Execution)

The Python MCP server provides 4 tools:

**analyze_directory(directory, project_root)**
- Scans directory for files
- Detects primary programming language
- Identifies patterns (tests, controllers, services, etc.)
- Analyzes imports/exports for dependencies
- Returns JSON with analysis results

**generate_context(directory, project_root, max_files)**
- Uses analysis data to generate CLAUDE.md markdown
- Creates structured documentation:
  - Module overview section (TODO for user to complete)
  - File summaries (one per file)
  - Key patterns & conventions
  - Internal and external dependencies
- Returns markdown content (doesn't write file yet)

**write_context(directory, content, smart_merge)**
- Writes CLAUDE.md to the directory
- Smart merge: If file exists, preserves user content outside `<!-- AUTO-GENERATED -->` blocks
- Returns success status and file path

**list_context_files(project_root)**
- Recursively finds all CLAUDE.md files in project
- Returns list of relative paths
- Useful for viewing existing documentation

**Server location:** `server/context_builder.py`
**Transport:** stdio (local process managed by Claude Code)
**Language:** Python 3.8+ (requires: `pip install mcp`)

### 3. Claude (Orchestration)

When the hook suggests MCP tools, Claude:
1. Sees the hook's decision and reason
2. Understands which directories need context building
3. Calls MCP tools in sequence for each directory:
   - First: `analyze_directory` to understand the module
   - Second: `generate_context` to create markdown
   - Third: `write_context` to save the file
4. Reports completion to user

### 4. Directory Summarization Skill

Provides Claude with:
- CLAUDE.md template structure
- Pattern detection methodology (naming conventions, architectural patterns, design patterns)
- Best practices for concise summaries
- Examples of effective vs. ineffective documentation
- Used when Claude needs guidance on documentation quality

## Generated CLAUDE.md Structure

The generated CLAUDE.md files follow this structure:

```markdown
<!-- AUTO-GENERATED by local-memory plugin on YYYY-MM-DD -->
<!-- To preserve custom content, add sections outside auto-gen blocks -->

# Module: [Directory Name]

## Overview
[High-level description of what this module/directory does]

## Files

### filename.ts
[1-2 sentence description of file's purpose and key exports]

### another-file.ts
[1-2 sentence description]

## Key Patterns & Conventions

- [Architectural patterns used]
- [Naming conventions]
- [Design decisions]

## Dependencies

**Depends on:**
- `../other-module` - [why this dependency exists]

**Used by:**
- `../consumer-module` - [how this module is used]

<!-- END AUTO-GENERATED CONTENT -->
```

## Git Tracking

By default, generated CLAUDE.md files are **not** automatically added to git. You can choose per-project whether to commit them:

**Commit to git** (team knowledge sharing):
```bash
git add src/module/CLAUDE.md
git commit -m "Add module context documentation"
```

**Keep local only** (personal notes):
```bash
# Add to .gitignore
echo "**/CLAUDE.md" >> .gitignore
```

## Best Practices

1. **Review generated CLAUDE.md files** - The agent does its best, but manual review improves quality
2. **Add custom sections** - Include team-specific context outside auto-gen blocks
3. **Update periodically** - Re-run `/build-context` after major changes to keep context current
4. **Commit valuable summaries** - Share high-quality CLAUDE.md files with your team
5. **Exclude test directories** - Add test/spec directories to `excludedDirectories` to reduce noise

## Troubleshooting

**MCP server not starting**:
- Check Python 3.8+ is installed: `python --version`
- Install MCP SDK: `pip install mcp`
- Verify server appears in `/mcp` output
- Check `claude --debug` for MCP connection errors

**CLAUDE.md not being generated**:
- Check that `autoGenerate: true` in settings
- Verify you edited 2+ files in the same directory
- Check that directory isn't in exclusion list
- Look for hook execution in `claude --debug` output
- Verify MCP server is running: `/mcp` should show local-memory
- Test hook script manually: `echo '{"transcript_path":"path","cwd":"dir"}' | sh hooks/scripts/check-context-trigger.sh`

**Hook script errors**:
- Ensure sh is available (should be present on all Unix-like systems and Git Bash on Windows)
- Check script has execute permissions: `chmod +x hooks/scripts/check-context-trigger.sh`
- Verify ${CLAUDE_PLUGIN_ROOT} is set correctly (automatic in Claude Code)
- Test with: `sh hooks/scripts/check-context-trigger.sh < test-input.json`

**MCP tool call failures**:
- Check directory path exists
- Verify Python script has no syntax errors
- Look for Python tracebacks in `claude --debug`
- Test MCP server manually: ask Claude "analyze directory src"

**CLAUDE.md is too long**:
- Reduce `maxFilesAnalyzed` in settings
- Ask Claude to analyze smaller subdirectories
- Manually edit to remove unnecessary details

**User content being overwritten**:
- Keep custom content outside `<!-- AUTO-GENERATED -->` blocks
- Add `<!-- USER CONTENT -->` markers for important sections
- Use git to track changes and revert if needed
- Smart merge should preserve user content - report bug if not working

## Examples

See `skills/directory-summarization/examples/` for example CLAUDE.md files showing effective module documentation.

## License

MIT

## Contributing

Issues and contributions welcome at https://github.com/AndaAndaman/claude-plugins
