---
name: build-context
description: Manually build CLAUDE.md context documentation for specified directory or current directory
args:
  - name: directory
    description: Optional directory path to build context for (defaults to current directory)
    required: false
---

# Build Context Command

## Purpose

This command manually triggers context building for a specified directory, creating or updating CLAUDE.md documentation with:
- Module overview and purpose
- File summaries (1-2 sentences each)
- Key patterns and conventions
- Dependencies and relationships

Use this when:
- You want to proactively document a directory before the Stop hook triggers
- You've manually refactored/reorganized code and want fresh documentation
- You want to check or refresh existing CLAUDE.md files
- You're exploring a new codebase and want to create breadcrumbs

## Usage

```bash
# Build context for current directory
/build-context

# Build context for specific directory
/build-context src/api
/build-context ./components/shared
/build-context ../utils

# Build context for multiple directories (space-separated)
/build-context src/api src/utils src/components
```

## How It Works

When invoked, this command:

1. **Validates directory paths**: Checks that specified directories exist
2. **Invokes context-builder agent**: Uses the specialized agent to orchestrate MCP tools
3. **Analyzes structure**: Agent uses `analyze_directory` MCP tool to scan files and patterns
4. **Generates content**: Agent uses `generate_context` MCP tool to create CLAUDE.md markdown
5. **Writes/merges**: Agent uses `write_context` MCP tool to write or smartly merge with existing files
6. **Reports results**: Provides clear feedback on success/failure

## Execution Instructions

### Step 1: Parse Arguments

```typescript
IF directory argument provided:
  directories = [directory_arg1, directory_arg2, ...]
ELSE:
  directories = [current_working_directory]
```

### Step 2: Validate Directories

For each directory:
- Verify directory exists (use Read or Bash to check)
- Convert to absolute path if relative
- Skip if directory doesn't exist (report error)

### Step 3: Invoke context-builder Agent

Use the context-builder agent to orchestrate the workflow:

```
I'll build context documentation for [directory].

Task(context-builder)
```

Pass the following information to the agent in your prompt:
- List of directories to process
- Project root path
- Any additional context from user's request

### Step 4: Monitor Progress

The context-builder agent will:
1. Use `analyze_directory` MCP tool to scan each directory
2. Use `generate_context` MCP tool to create documentation
3. Use `write_context` MCP tool to save/merge CLAUDE.md files
4. Report results for each directory

### Step 5: Report Final Results

After the agent completes, summarize results:

```
✓ Built context for src/api (12 files documented)
✓ Built context for src/utils (8 files documented)

CLAUDE.md files created. These will automatically load as context in future sessions.
```

## Examples

### Example 1: Current Directory

**Command**: `/build-context`

**Output**:
```
I'll build context documentation for the current directory.

[Invoke context-builder agent]

✓ Built context for . (15 files documented)

CLAUDE.md created in current directory.
```

---

### Example 2: Specific Directory

**Command**: `/build-context src/api`

**Output**:
```
I'll build context documentation for src/api.

[Invoke context-builder agent]

Analyzing src/api...
- Detected: TypeScript Express API module
- Files: 12 TypeScript files, 3 test files
- Patterns: Controller-Service pattern, dependency injection
- Dependencies: express, typeorm, class-validator

✓ Built context for src/api (12 files documented)

CLAUDE.md created at src/api/CLAUDE.md
```

---

### Example 3: Multiple Directories

**Command**: `/build-context src/api src/utils src/models`

**Output**:
```
I'll build context documentation for 3 directories.

[Invoke context-builder agent]

Processing...

✓ Built context for src/api (12 files documented)
✓ Built context for src/utils (8 files documented)
✓ Built context for src/models (15 files documented)

3 CLAUDE.md files created/updated.
```

---

### Example 4: Directory Not Found

**Command**: `/build-context src/nonexistent`

**Output**:
```
✗ Error: Directory 'src/nonexistent' does not exist.

Please check the path and try again.
```

---

### Example 5: Updating Existing Context

**Command**: `/build-context src/components`

**Output**:
```
I'll update context documentation for src/components.

[Invoke context-builder agent]

Analyzing src/components...
- Found existing CLAUDE.md (will smart merge)
- Detected: React component library
- Changes: 3 new components added, 2 components updated

✓ Updated context for src/components (25 files documented)

CLAUDE.md updated at src/components/CLAUDE.md
- User sections preserved (before and after auto-generated block)
- Auto-generated sections refreshed
```

## MCP Tools Reference

The context-builder agent uses these MCP tools (you don't call them directly):

| Tool | Purpose |
|------|---------|
| `analyze_directory` | Scans directory structure, detects language/framework, analyzes imports |
| `generate_context` | Creates CLAUDE.md markdown content following best practices |
| `write_context` | Writes or smartly merges content into CLAUDE.md file |
| `list_context_files` | Lists all CLAUDE.md files in project (for reference) |

## Smart Merge Behavior

When a CLAUDE.md file already exists:
- **Preserves**: User-written sections, custom notes, manual additions
- **Updates**: Auto-generated sections (marked with comments)
- **Reports**: Shows what was preserved vs. updated, with warnings if content seems short or long

## Error Handling

Common issues and resolutions:

| Error | Cause | Resolution |
|-------|-------|------------|
| "Directory not found" | Path doesn't exist | Check path spelling and try again |
| "MCP server not running" | local-memory MCP server offline | Run `/mcp` to check status, restart if needed |
| "Permission denied" | No write access to directory | Check file permissions |
| "Analysis failed" | MCP tool error | Check MCP server logs, ensure Python dependencies installed |

## Configuration

The command respects `.claude/local-memory.local.md` settings:

```yaml
---
# Directories to exclude from analysis
excludedDirectories:
  - node_modules
  - dist
  - build
  - test
  - coverage

# Maximum files to analyze per directory
maxFilesAnalyzed: 50
---
```

However, manual `/build-context` command:
- **Ignores** `autoGenerate: false` (you explicitly requested it)
- **Respects** `excludedDirectories` (won't analyze excluded dirs)
- **Respects** `maxFilesAnalyzed` limit

## Integration

This command:
- **Invokes**: `context-builder` agent for orchestration
- **Uses**: `local-memory` MCP server tools
- **References**: `directory-summarization` skill for best practices
- **Creates**: CLAUDE.md files that auto-load in future sessions

## Success Criteria

Command succeeds when:
1. All specified directories validated
2. Context-builder agent invoked successfully
3. CLAUDE.md files created or updated
4. Clear success/failure feedback provided
5. No MCP tool errors

## Notes

- **Proactive use encouraged**: Don't wait for Stop hook, use this command anytime
- **Safe operation**: Smart merge preserves your manual edits
- **Batch processing**: Can handle multiple directories in one command
- **Fast execution**: Uses Haiku model for speed (context-builder agent)
- **Quality assured**: Uses directory-summarization skill best practices

## Tips

**Best Times to Use:**
- After refactoring a module
- When exploring unfamiliar code
- Before ending a coding session
- When onboarding to a new codebase
- After adding new files to a directory

**Avoid:**
- Extremely large directories (>100 files) - may be slow
- Excluded directories (node_modules, dist, etc.) - won't work
- Binary/data directories - not useful for documentation

**Pro Tips:**
- Run regularly to keep context fresh
- Use with specific subdirectories for focused documentation
- Check generated CLAUDE.md and add manual notes if needed
- User content before and after auto-generated markers is preserved during merge
