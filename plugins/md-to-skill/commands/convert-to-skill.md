---
name: convert-to-skill
description: Convert a markdown file into an organized Claude skill structure
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
  - AskUserQuestion
  - Task(skill-builder)
arguments:
  - name: file
    description: Path to markdown file to convert
    required: true
argument-hint: <markdown-file-path>
---

# Convert Markdown to Skill Command

Convert an unstructured markdown file into a properly organized Claude Code skill with automatic structure analysis, quality validation, and intelligent content merging.

## Purpose

This command takes a markdown file (from LLM exports, manual creation, or any source) and transforms it into a Claude skill with:
- Parsed structure and extracted sections
- Generated SKILL.md with progressive disclosure
- Code blocks (>10 lines) extracted to examples/
- Detailed content organized into references/
- Auto-generated frontmatter with trigger phrases
- Quality validation and auto-fixes

## Execution Workflow

### Step 1: Validate Input

Read the specified markdown file and verify:
- File exists and is readable
- File is actually markdown (.md extension)
- File has substantial content (>200 words)
- File structure is parseable

If validation fails, show clear error message to user.

### Step 2: Launch skill-builder Agent

Launch the skill-builder agent to handle the conversion:

```
Task(skill-builder)
```

The agent will receive the file path from context and handle:
- Content analysis and structure parsing
- Name generation (3 options)
- Scope selection (user/project)
- Conflict detection and merging
- Quality validation and auto-fixes
- Optional source file cleanup

### Step 3: Present Results

After agent completes, show user:
- ✓ Skill created at [location]
- Structure overview (SKILL.md size, reference count, example count)
- Any quality issues fixed
- Next steps (how to test, how to use)

## User Interaction

The skill-builder agent will interact with user to:

1. **Select skill name** - Show 3 auto-generated options based on content
2. **Choose scope** - User or project scope installation
3. **Handle conflicts** - If skill name exists, ask to merge (show preview first)
4. **Clean source** - Ask permission to delete source .md file after conversion

## Examples

**Convert a single file:**
```
/convert-to-skill api-documentation.md
```

**Convert from different directory:**
```
/convert-to-skill ../docs/authentication-guide.md
```

**Convert exported ChatGPT conversation:**
```
/convert-to-skill chatgpt-export-react-patterns.md
```

## What Gets Created

**SKILL.md:**
- Core content (1,500-2,000 words)
- Progressive disclosure format
- Imperative writing style
- References to supporting files

**references/ (if needed):**
- Detailed documentation by topic
- One file per major section/topic
- Descriptive filenames (kebab-case)

**examples/ (if code blocks >10 lines):**
- Extracted code blocks
- Named by content and language
- Complete, runnable examples

## Skill Name Generation

The agent generates 3 name options from:
1. H1 heading (if present)
2. Topic-based (key concepts in content)
3. Function-based (what content teaches)

Names are:
- kebab-case format
- 2-4 words
- Descriptive and specific
- No special characters

## Scope Options

**User scope** (`~/.claude-plugins/skills/`):
- Available in all projects
- Global skill installation
- Recommended for general knowledge

**Project scope** (`./.claude/skills/`):
- Available only in current project
- Project-specific knowledge
- Recommended for proprietary/domain-specific content

## Conflict Handling

If a skill with the same name already exists:

1. **Show preview** of what will be merged:
   - New sections to add
   - Existing sections to update
   - New references/examples

2. **Ask user** to approve or cancel merge

3. **If approved** - Intelligently merge content:
   - Deduplicate similar sections
   - Preserve existing structure
   - Add new topics to references/
   - Combine examples/
   - Update frontmatter

4. **If canceled** - Abort conversion

## Quality Validation

The agent automatically:
- ✓ Generates strong trigger phrases
- ✓ Ensures SKILL.md is lean (1,500-2,000 words)
- ✓ Validates frontmatter format
- ✓ Checks writing style (imperative form)
- ✓ Verifies progressive disclosure
- ✓ Validates file naming conventions

Auto-fixes are applied when possible. User is notified of fixes.

## Source File Cleanup

After successful conversion, agent asks:
```
Delete source file [filename].md? (y/n)
```

If user approves:
- Original markdown file is deleted
- Only the skill structure remains
- Confirmation message shown

## Error Handling

**File not found:**
```
Error: Cannot find markdown file at [path]
Please check the file path and try again.
```

**Invalid markdown:**
```
Error: File [name] is not a markdown file
Only .md files can be converted to skills.
```

**Insufficient content:**
```
Warning: File [name] has only [X] words
Minimum 200 words recommended for skill conversion.
Continue anyway? (y/n)
```

**Conversion failed:**
```
Error: Failed to convert markdown to skill
[Specific error message from agent]
```

## Tips

**For best results:**
- Use markdown with clear heading hierarchy (H1, H2, H3)
- Include code blocks with language tags
- Organize content logically by topics
- Use descriptive headings

**Content structure:**
- H1 → Skill name
- H2 → Reference files or major sections
- H3+ → Subsections within references
- Code blocks → examples/ if >10 lines

**Iterative improvement:**
- Convert initial markdown → skill
- Use the skill in practice
- Generate updated markdown with improvements
- Run /convert-to-skill again → merges improvements
- Repeat to continuously enhance skill

## Related Commands

- `/learn-skill [topic]` - Scan directory for potential skills
- View created skills in ~/.claude-plugins/skills/ or .claude/skills/

## Implementation Notes

- Command launches skill-builder agent to handle all logic
- Agent has access to: Read, Write, Grep, Glob, Bash, AskUserQuestion
- Agent uses markdown-parsing and skill-structure-patterns skills
- Command only validates input and launches agent
- All user interaction happens through agent

## Success Criteria

Conversion is successful when:
- ✓ Skill directory created with proper structure
- ✓ SKILL.md has valid frontmatter and content
- ✓ Progressive disclosure maintained (lean SKILL.md)
- ✓ Code blocks >10 lines extracted to examples/
- ✓ Detailed content in references/
- ✓ Quality validation passed
- ✓ User confirmed satisfaction with result
