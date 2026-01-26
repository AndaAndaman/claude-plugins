# SKILL.md Template

This template provides a fill-in-the-blank structure for creating effective Claude Code skills.

## Template

```markdown
---
name: [Descriptive Skill Name in Title Case]
description: This skill should be used when the user asks to "[specific phrase 1]", "[specific phrase 2]", "[specific phrase 3]", or mentions [key concept]. [Brief 1-2 sentence explanation of what skill provides].
version: 0.1.0
---

# [Skill Name]

## Purpose

[2-4 sentences explaining what this skill does and what problem it solves. Be specific and concrete.]

## When to Use

Use this skill when:
- [Specific scenario 1]
- [Specific scenario 2]
- [Specific scenario 3]
- [Specific scenario 4]

## [Core Concept 1]

[Explanation of the first core concept. Use imperative form: "To do X, follow these steps" not "You should do X".]

### [Subsection 1.1]

[Details about this aspect. Include examples, code snippets if short, or tables.]

### [Subsection 1.2]

[More details. Keep focused on essentials.]

## [Core Concept 2]

[Explanation of the second core concept.]

### [Subsection 2.1]

[Details with examples.]

## [Workflow/Process Section]

[Step-by-step procedures if applicable.]

### Step 1: [Action]

[What to do and why.]

### Step 2: [Action]

[What to do and why.]

### Step 3: [Action]

[What to do and why.]

## [Best Practices / Common Patterns]

[Quick reference for common scenarios.]

**[Pattern 1 Name]:**
- [Key point 1]
- [Key point 2]
- [Key point 3]

**[Pattern 2 Name]:**
- [Key point 1]
- [Key point 2]
- [Key point 3]

## Edge Cases

[Optional: Address common edge cases or gotchas.]

### [Edge Case 1]

[Description and how to handle it.]

### [Edge Case 2]

[Description and how to handle it.]

## Summary

[2-4 sentences summarizing the key takeaways. What are the most important things to remember?]

## Additional Resources

[If you have supporting files, reference them here.]

### Reference Files

For detailed information, consult:
- **`references/[filename].md`** - [Description]
- **`references/[filename].md`** - [Description]

### Example Files

Working examples in `examples/`:
- **`[filename].ext`** - [Description]
- **`[filename].ext`** - [Description]

### Utility Scripts

Helper scripts in `scripts/`:
- **`[filename].sh`** - [Description]
- **`[filename].py`** - [Description]
```

## Frontmatter Guidelines

### Name Field

**Format:** Title Case, descriptive, 2-5 words

**Good examples:**
- `API Integration Patterns`
- `Database Migration Tools`
- `Frontend Component Guide`

**Bad examples:**
- `api-integration-patterns` (not Title Case)
- `Stuff` (not descriptive)
- `The Complete Comprehensive Guide to API Integration Patterns and Best Practices` (too long)

### Description Field

**Must include:**
1. Opening: "This skill should be used when..."
2. Trigger phrases: 3-7 specific phrases in quotes
3. Key concepts: Mention important terminology
4. Brief explanation: What skill provides (1-2 sentences)

**Template structure:**
```
This skill should be used when the user asks to "[action 1]", "[action 2]", "[action 3]", or mentions [concept]. [Explanation of what skill provides].
```

**Example:**
```yaml
description: This skill should be used when the user asks to "create a hook", "add a PreToolUse hook", "validate tool use", "implement prompt-based hooks", or mentions hook events (PreToolUse, PostToolUse, Stop). Provides comprehensive Claude Code hooks API guidance including event types, matchers, and response schemas.
```

### Version Field

**Format:** Semantic versioning (MAJOR.MINOR.PATCH)

**Starting version:** `0.1.0`
**Stable release:** `1.0.0`
**Bug fixes:** Increment PATCH (1.0.1)
**New features:** Increment MINOR (1.1.0)
**Breaking changes:** Increment MAJOR (2.0.0)

## Body Structure Guidelines

### Required Sections

**Purpose** (required)
- What the skill does
- What problem it solves
- 2-4 sentences

**When to Use** (required)
- Specific scenarios
- Bullet list format
- 3-6 items

**Core Content** (required)
- Main concepts and procedures
- Multiple H2 sections as needed
- Use H3 subsections for organization

**Summary** (recommended)
- Key takeaways
- 2-4 sentences
- Reinforce most important points

**Additional Resources** (if applicable)
- List references/, examples/, scripts/
- Brief description of each file

### Optional Sections

**Best Practices**
- Quick reference patterns
- Common scenarios
- Tips and tricks

**Edge Cases**
- Unusual scenarios
- Gotchas and pitfalls
- How to handle them

**Examples**
- Inline examples if short
- Reference examples/ if long

**Troubleshooting**
- Common issues
- Solutions

## Writing Style

### Imperative Form

✅ **Use:**
- "To create a skill, start with..."
- "Parse the file using..."
- "Extract sections larger than..."

❌ **Avoid:**
- "You should create a skill by..."
- "You can parse the file..."
- "You might want to extract..."

### Active Voice

✅ **Use:**
- "Claude loads the skill when triggered"
- "The tool extracts code blocks"
- "Validate input before processing"

❌ **Avoid:**
- "The skill is loaded by Claude"
- "Code blocks are extracted by the tool"
- "Input should be validated"

### Objective Language

✅ **Use:**
- "Configure the setting before use"
- "This approach provides better performance"
- "Validate ensures correctness"

❌ **Avoid:**
- "You should configure..."
- "I recommend this approach..."
- "It's important that you validate..."

## Content Length Guidelines

**SKILL.md body:**
- Target: 1,500-2,000 words
- Maximum: 3,000 words
- Beyond 3,000: Move content to references/

**Each reference file:**
- Typical: 800-2,500 words
- Can be longer for comprehensive docs
- Focus on single topic

**Summary section:**
- 100-200 words
- 2-4 sentences or short bullet list

## Progressive Disclosure

### What Stays in SKILL.md

**Keep:**
- Purpose and overview
- When to use
- Core concepts (essential knowledge only)
- Step-by-step procedures (high level)
- Quick reference tables
- Pointers to references/
- Common use cases

### What Moves to references/

**Move:**
- Detailed patterns and techniques
- Advanced use cases
- Comprehensive documentation
- Edge cases and troubleshooting
- Historical context
- Extensive examples with explanations
- API specifications
- Migration guides

### Decision Framework

Ask: "Is this essential for someone starting to use this skill?"
- Yes → Keep in SKILL.md
- No, but useful for deeper work → Move to references/
- No, shows implementation → Move to examples/

## Examples

### Minimal Skill

```markdown
---
name: Simple Helper
description: This skill should be used when the user asks to "do simple task", "perform basic operation". Provides guidance for simple operations.
version: 0.1.0
---

# Simple Helper

## Purpose

Provides guidance for performing simple operations quickly and reliably.

## When to Use

Use this skill when:
- Performing quick operations
- Need basic guidance
- Working with standard workflows

## Core Concept

To perform the operation:
1. Prepare the input
2. Execute the process
3. Validate the output

## Summary

Simple operations require preparation, execution, and validation. Follow the three-step process for reliable results.
```

### Standard Skill

```markdown
---
name: Standard Skill Template
description: This skill should be used when the user asks to "perform standard task", "work with standard workflow", "follow standard process". Provides comprehensive guidance with references.
version: 0.1.0
---

# Standard Skill Template

## Purpose

Provides comprehensive guidance for standard workflows with detailed references for advanced scenarios.

## When to Use

Use this skill when:
- Working with standard workflows
- Need step-by-step guidance
- Require detailed documentation
- Want working examples

## Core Concepts

### Concept 1

[Overview of concept 1. Keep essential details here.]

### Concept 2

[Overview of concept 2. Keep essential details here.]

## Workflow

### Step 1: Preparation

[High-level guidance for preparation phase.]

### Step 2: Execution

[High-level guidance for execution phase.]

### Step 3: Validation

[High-level guidance for validation phase.]

## Best Practices

**Pattern 1:**
- Use this when X
- Provides Y benefit
- Example: Z

**Pattern 2:**
- Use this when A
- Provides B benefit
- Example: C

## Summary

Standard workflows involve preparation, execution, and validation. Follow best practices for reliable results. See references/ for detailed patterns and examples/ for working code.

## Additional Resources

### Reference Files

For detailed information:
- **`references/patterns.md`** - Common implementation patterns
- **`references/advanced.md`** - Advanced techniques

### Example Files

Working examples:
- **`example-basic.py`** - Basic usage
- **`example-advanced.js`** - Advanced usage
```

## Checklist

Before finalizing SKILL.md:

**Frontmatter:**
- [ ] `name` field present and Title Case
- [ ] `description` starts with "This skill should be used when..."
- [ ] `description` includes 3-7 specific trigger phrases in quotes
- [ ] `description` mentions key concepts
- [ ] `version` follows semantic versioning

**Structure:**
- [ ] Has "Purpose" section (2-4 sentences)
- [ ] Has "When to Use" section (3-6 bullet points)
- [ ] Has core content sections (H2 level)
- [ ] Has "Summary" section (2-4 sentences)
- [ ] References supporting files (if they exist)

**Writing Style:**
- [ ] Uses imperative/infinitive form (verb-first)
- [ ] Avoids second person ("you")
- [ ] Uses active voice
- [ ] Objective and instructional

**Length:**
- [ ] Body is 1,500-2,000 words (or has good reason to exceed)
- [ ] If > 3,000 words, detailed content moved to references/

**Quality:**
- [ ] Clear and concise
- [ ] Logical flow
- [ ] Scannable (lists, tables, code blocks)
- [ ] No duplicate content across files

Use this template as a starting point and adapt to your specific skill needs.
