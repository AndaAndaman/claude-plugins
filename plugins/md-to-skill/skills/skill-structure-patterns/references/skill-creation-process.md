# Skill Creation Process

This document provides a step-by-step workflow for creating effective Claude Code skills.

## Overview

Follow these steps in order when creating a skill. Skip steps only when there's a clear reason they don't apply.

## Step 1: Understanding the Skill with Concrete Examples

**Purpose:** Clearly understand how the skill will be used before building it.

**When to skip:** Only when the skill's usage patterns are already clearly understood.

### Gather Examples

Understand concrete examples through either:
- Direct user examples of intended usage
- Generated examples validated with user feedback

### Key Questions

For example, when building an image-editor skill:
- "What functionality should the skill support? Editing, rotating, anything else?"
- "Can you give examples of how this skill would be used?"
- "What would a user say that should trigger this skill?"

### Example Scenarios

**PDF Editor Skill:**
- User query: "Help me rotate this PDF"
- User query: "Merge these two PDF files"
- User query: "Extract pages 5-10 from document.pdf"

**Frontend Builder Skill:**
- User query: "Build me a todo app"
- User query: "Create a dashboard to track my steps"
- User query: "Generate a React component for user profile"

**BigQuery Skill:**
- User query: "How many users have logged in today?"
- User query: "Show revenue by product category"
- User query: "Query the user_events table"

### Avoid Overwhelming Users

- Don't ask too many questions at once
- Start with the most important questions
- Follow up as needed for better effectiveness

### Completion Criteria

Complete this step when there's a clear sense of:
- What functionality the skill should support
- How users will interact with it
- What triggers should activate it

## Step 2: Planning Reusable Skill Contents

**Purpose:** Identify what scripts, references, and assets would make the skill reusable and efficient.

### Analysis Process

For each concrete example:

1. **Consider execution from scratch** - How would Claude handle this without any skill?
2. **Identify repetitive work** - What gets rewritten or rediscovered each time?
3. **Determine helpful resources** - What files would eliminate that repetition?

### Resource Categories

**scripts/** - When code gets rewritten repeatedly:
```
Example: PDF rotation requires same code each time
Solution: scripts/rotate_pdf.py
Benefit: Deterministic, token-efficient, may execute without loading
```

**assets/** - When boilerplate is needed in output:
```
Example: Frontend apps need same HTML/React boilerplate
Solution: assets/hello-world/ template directory
Benefit: Copy and customize instead of regenerating
```

**references/** - When information is rediscovered each time:
```
Example: BigQuery needs table schemas and relationships
Solution: references/schema.md
Benefit: Load once instead of re-exploring
```

**examples/** - When users need working code samples:
```
Example: Hook implementation patterns
Solution: examples/pre-tool-use-validation.json
Benefit: Copy-paste starting point
```

### Decision Matrix

| Situation | Resource Type | Example |
|-----------|---------------|---------|
| Same code written repeatedly | `scripts/` | PDF rotation script |
| Boilerplate for output | `assets/` | HTML template |
| Schema/docs to reference | `references/` | Database schema |
| Working code samples | `examples/` | Configuration examples |
| Validation needed | `scripts/` | Schema validator |
| Complex patterns | `references/` | Design patterns guide |

### Real Examples

**PDF Editor Skill:**
- `scripts/rotate_pdf.py` - Rotation utility
- `scripts/merge_pdf.py` - Merge utility
- `examples/batch-process.sh` - Batch processing example

**Frontend Builder Skill:**
- `assets/hello-world/` - Boilerplate project
- `references/component-patterns.md` - React patterns
- `examples/todo-app/` - Complete example

**BigQuery Skill:**
- `references/schema.md` - Table schemas
- `references/query-patterns.md` - Common queries
- `examples/analytics-queries.sql` - Working queries

### Output

Create a list of resources to include:
```
Planned resources for [skill-name]:
- scripts/
  - utility1.py
  - utility2.sh
- references/
  - topic1.md
  - topic2.md
- examples/
  - example1.js
  - config.json
- assets/
  - template/
```

## Step 3: Create Skill Structure

### For Plugin Skills

Create directory structure directly in plugin:

```bash
mkdir -p plugin-name/skills/skill-name/{references,examples,scripts,assets}
touch plugin-name/skills/skill-name/SKILL.md
```

### For Standalone Skills

Use the skill creator or manual structure:

```bash
mkdir -p ~/.claude-plugins/skills/skill-name/{references,examples,scripts,assets}
touch ~/.claude-plugins/skills/skill-name/SKILL.md
```

### Delete Unused Directories

Only create directories you actually need:
- If no scripts needed, delete `scripts/`
- If no references needed, delete `references/`
- Keep structure minimal

### Directory Creation Based on Plan

From Step 2, create only directories in your resource list:

```bash
# If plan shows scripts and references, but no examples:
mkdir -p skill-name/{scripts,references}
# Don't create examples/ or assets/
```

## Step 4: Edit the SKILL.md

**Remember:** Writing for another Claude instance to use.

### Focus Areas

Include information that would be:
- Beneficial and non-obvious to Claude
- Procedural knowledge
- Domain-specific details
- Reusable assets guidance

### Start with Reusable Contents

Implement resources from Step 2 first:

1. **scripts/** - Write utility scripts
2. **references/** - Create reference documentation
3. **examples/** - Add working code examples
4. **assets/** - Include templates or files

**Note:** May require user input for:
- Brand assets
- Templates
- Documentation
- API keys or credentials (store securely)

### Update SKILL.md Frontmatter

**Required format:**

```yaml
---
name: kebab-case-skill-name
description: This skill should be used when the user asks to "specific phrase 1", "specific phrase 2", "specific phrase 3", or mentions technical-term. Brief explanation of what skill provides.
---
```

**Name rules:** Kebab-case, lowercase letters/numbers/hyphens only, max 64 chars. If omitted, uses directory name.

**Description requirements:**
- Max 1024 characters
- Third-person format
- 3-7 specific trigger phrases in quotes
- Key concepts or terminology
- Brief 1-2 sentence purpose at end

**Optional fields:** `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `context`, `agent`, `argument-hint`, `hooks`. Do NOT use `version` (not a valid field).

**Good description example:**
```yaml
description: This skill should be used when the user asks to "create a hook", "add a PreToolUse hook", "validate tool use", "implement prompt-based hooks", or mentions hook events (PreToolUse, PostToolUse, Stop). Provides comprehensive hooks API guidance.
```

**Bad description examples:**
```yaml
description: Use this skill when working with hooks.  # Wrong person, vague
description: Provides hook guidance.  # No trigger phrases
```

### Write SKILL.md Body

Answer these questions in imperative form:

1. **What is the purpose?** (2-3 sentences)
2. **When should the skill be used?** (List scenarios)
3. **How should Claude use it?** (Reference all resources from Step 3)

**Target length:** Under 500 lines

**Keep lean by:**
- Moving detailed content to `references/`
- Moving patterns to `references/patterns.md`
- Moving advanced topics to `references/advanced.md`
- Moving API docs to `references/api-reference.md`

**Reference resources clearly:**

```markdown
## Additional Resources

### Reference Files

For detailed patterns and techniques, consult:
- **`references/patterns.md`** - Common patterns
- **`references/advanced.md`** - Advanced use cases

### Example Files

Working examples in `examples/`:
- **`example-script.sh`** - Working example
- **`config-template.json`** - Configuration template

### Utility Scripts

Helper scripts in `scripts/`:
- **`validate.sh`** - Validate configuration
- **`process.py`** - Process data
```

### Writing Style

**Imperative/Infinitive form (verb-first):**

✅ Correct:
```
To create a hook, define the event type.
Parse the markdown file using Read tool.
Extract code blocks larger than 10 lines.
Configure the setting before use.
```

❌ Incorrect:
```
You should create a hook by defining...
You need to parse the markdown file...
You can extract code blocks...
You might want to configure...
```

**Objective and instructional:**

✅ Correct:
```
Validate input to ensure correctness.
Use the grep tool to search for patterns.
Reference supporting files in SKILL.md.
```

❌ Incorrect:
```
You should validate input...
It's recommended that you use grep...
You can reference supporting files...
```

## Step 5: Validate and Test

### Structure Validation

Check that:
- [ ] SKILL.md exists with valid YAML frontmatter
- [ ] Frontmatter has `name` and `description` fields
- [ ] Markdown body is present and substantial
- [ ] All referenced files actually exist

### Description Quality

Verify description:
- [ ] Uses third person ("This skill should be used when...")
- [ ] Includes 3-7 specific trigger phrases users would say
- [ ] Lists concrete scenarios in quotes
- [ ] Not vague or generic
- [ ] Ends with brief purpose statement

### Content Quality

Check SKILL.md body:
- [ ] Uses imperative/infinitive form (verb-first)
- [ ] Avoids second person ("you should...")
- [ ] Is focused and lean (under 500 lines)
- [ ] References all supporting files
- [ ] Has clear section structure

### Progressive Disclosure

Verify organization:
- [ ] Core concepts in SKILL.md
- [ ] Detailed docs moved to references/
- [ ] Working code in examples/
- [ ] Utilities in scripts/
- [ ] SKILL.md references these resources appropriately

### Testing

Test the skill:
- [ ] Triggers on expected user queries
- [ ] Content is helpful for intended tasks
- [ ] No duplicated information across files
- [ ] References load when Claude needs them

### Use Skill-Reviewer Agent

For automated validation:

```bash
# In Claude Code
/review-skill skill-name
```

The skill-reviewer agent checks:
- Description quality
- Content organization
- Progressive disclosure
- Writing style
- File references

## Step 6: Iterate

**When:** After using the skill on real tasks

### Iteration Workflow

1. **Use skill on real tasks** - Let it run in practice
2. **Notice struggles** - Where does Claude struggle or act inefficiently?
3. **Identify improvements** - What needs updating?
4. **Implement changes** - Update SKILL.md or resources
5. **Test again** - Verify improvements work

### Common Improvements

**Strengthen trigger phrases:**
```yaml
# Before
description: This skill helps with hooks.

# After
description: This skill should be used when the user asks to "create a hook", "add PreToolUse hook", "validate tool use", or mentions hook events.
```

**Move content to references:**
```
# Before: SKILL.md is 4,000 words

# After:
- SKILL.md: 1,800 words (core content)
- references/patterns.md: 1,500 words
- references/advanced.md: 700 words
```

**Add missing examples:**
```
# Before: No working examples

# After:
- examples/basic-usage.sh
- examples/advanced-example.json
- examples/config-template.yaml
```

**Clarify ambiguous instructions:**
```
# Before
"Process the file appropriately."

# After
"Parse the markdown file using Read tool. Extract headings with regex pattern `^#{1,6}\s+(.+)$`. Split content at H2 boundaries."
```

**Add edge case handling:**
```
# Add to references/troubleshooting.md:
- What to do if frontmatter is missing
- How to handle malformed YAML
- Steps when code blocks lack language tags
```

### Iteration Triggers

Run iteration when:
- Users report confusion
- Claude misuses the skill
- New use cases emerge
- Better patterns discovered
- Technology changes

### Keep Iterating

Skills improve over time through:
- Real-world usage
- User feedback
- Technology evolution
- New patterns discovered

Continuous improvement is key to maintaining effective skills.

## Quick Reference

### Minimal Steps

For simple skills, minimum process:

1. **Understand:** What will users ask?
2. **Plan:** What resources needed?
3. **Create:** Make SKILL.md with frontmatter
4. **Write:** Add body content (under 500 lines)
5. **Test:** Verify triggers and usefulness

### Standard Steps

For most skills, follow all steps:

1. **Understand** with concrete examples
2. **Plan** reusable resources (scripts/references/examples)
3. **Create** directory structure
4. **Edit** SKILL.md and resources
5. **Validate** structure, description, content, organization
6. **Iterate** based on usage

### Complex Skills

For complex domains:

1. **Understand** multiple use cases thoroughly
2. **Plan** comprehensive resources across all categories
3. **Create** full structure with all directories
4. **Edit** SKILL.md (lean), references (detailed), examples (working), scripts (utilities)
5. **Validate** rigorously using skill-reviewer
6. **Iterate** continuously as patterns emerge

## Best Practices Summary

✅ **DO:**
- Start with concrete examples
- Plan resources before creating
- Keep SKILL.md lean (1,500-2,000 words)
- Use third-person in description
- Include specific trigger phrases
- Write in imperative form
- Reference all supporting files
- Test with real queries
- Iterate based on usage

❌ **DON'T:**
- Skip understanding phase
- Put everything in SKILL.md
- Use vague trigger descriptions
- Write in second person
- Leave resources unreferenced
- Skip validation
- Consider it "done" after first version

## Examples from Real Skills

### Hook Development Skill

**Step 1 - Examples collected:**
- "Create a PreToolUse hook to validate git commands"
- "Add a Stop hook to run quick wins analysis"
- "Block dangerous bash commands with hooks"

**Step 2 - Resources planned:**
- `references/hook-api.md` - Complete API reference
- `references/patterns.md` - Common patterns
- `examples/pre-tool-use-validation.json` - Working example
- `scripts/validate-hook.sh` - Validation utility

**Step 4 - Description written:**
```yaml
description: This skill should be used when the user asks to "create a hook", "add a PreToolUse/PostToolUse/Stop hook", "validate tool use", "implement prompt-based hooks", or mentions hook events (PreToolUse, PostToolUse, Stop, SubagentStop). Provides comprehensive hooks API guidance.
```

**Result:** Excellent skill with strong triggers, lean SKILL.md (1,651 words), comprehensive references.

### Plugin Settings Skill

**Step 1 - Examples collected:**
- "How do I make my plugin configurable?"
- "Store plugin settings per-project"
- "Read YAML frontmatter from .local.md"

**Step 2 - Resources planned:**
- `references/real-examples.md` - Working implementations
- `examples/parse-settings.sh` - Parsing script
- `scripts/validate-yaml.sh` - Validation utility

**Step 4 - Description written:**
```yaml
description: This skill should be used when the user asks about "plugin settings", "store plugin configuration", "user-configurable plugin", ".local.md files", "plugin state files", or wants to make plugin behavior configurable.
```

**Result:** Focused skill with practical examples, clear patterns.

## Conclusion

Effective skill creation is a process:
1. Understand use cases deeply
2. Plan reusable resources thoughtfully
3. Create lean, well-organized structure
4. Write with strong triggers and imperative style
5. Validate thoroughly
6. Iterate based on real usage

Follow this process to create skills that trigger correctly, load efficiently, and provide comprehensive guidance when needed.
