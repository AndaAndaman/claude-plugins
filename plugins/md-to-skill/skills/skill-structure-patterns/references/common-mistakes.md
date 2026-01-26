# Common Mistakes in Skill Creation

This document catalogs common mistakes when creating Claude Code skills and how to avoid them.

## Mistake 1: Weak Trigger Description

### The Problem

**❌ Bad Examples:**

```yaml
description: Provides guidance for working with hooks.
```
**Why bad:** Vague, no specific trigger phrases, not third person

```yaml
description: Use this skill when you need hook help.
```
**Why bad:** Wrong person (second person), no concrete phrases

```yaml
description: Hook development guidance.
```
**Why bad:** No trigger phrases at all, just a label

```yaml
description: This skill helps with creating, updating, and managing hooks.
```
**Why bad:** Generic verbs, no specific user phrases in quotes

### The Solution

**✅ Good Example:**

```yaml
description: This skill should be used when the user asks to "create a hook", "add a PreToolUse hook", "validate tool use", "implement prompt-based hooks", or mentions hook events (PreToolUse, PostToolUse, Stop). Provides comprehensive hooks API guidance.
```

**Why good:**
- ✅ Third person ("This skill should be used when...")
- ✅ Specific phrases in quotes ("create a hook", "add a PreToolUse hook")
- ✅ Concrete scenarios users would actually say
- ✅ Technical keywords (PreToolUse, PostToolUse, Stop)
- ✅ Brief purpose statement at end

### How to Fix

**Analysis process:**

1. **Read the skill content** - What does it actually help with?
2. **Identify key actions** - What verbs? (create, parse, validate, etc.)
3. **Extract domain terms** - What technical terms? (hook, PreToolUse, etc.)
4. **Combine into phrases** - "create a hook", "add PreToolUse hook"
5. **Test phrase specificity** - Would users actually say this?

**Template:**
```yaml
description: This skill should be used when the user asks to "[action] [thing]", "[action2] [thing]", "[task description]", or mentions [technical-term1], [technical-term2]. [Brief 1-sentence purpose].
```

### Examples of Fixes

**Before:**
```yaml
description: Helps with markdown conversion.
```

**After:**
```yaml
description: This skill should be used when the user asks to "convert markdown to skill", "parse markdown structure", "extract code blocks from markdown", "split markdown by sections", or mentions SKILL.md, frontmatter, or progressive disclosure. Provides patterns for markdown analysis and skill generation.
```

---

**Before:**
```yaml
description: API integration guidance.
```

**After:**
```yaml
description: This skill should be used when the user asks to "integrate REST API", "parse API response", "generate API client", "handle API authentication", or mentions OpenAPI, Swagger, or API endpoints. Provides comprehensive API integration patterns.
```

## Mistake 2: Too Much Content in SKILL.md

### The Problem

**❌ Bad Structure:**

```
skill-name/
└── SKILL.md  (8,000 words - everything in one massive file)
```

**Why bad:**
- Bloats context when skill loads
- Detailed content always loaded even when not needed
- Violates progressive disclosure principle
- Makes skill slow to process
- Harder to navigate and maintain

**Symptoms:**
- SKILL.md > 3,000 words
- Multiple detailed sections (>500 words each)
- Extensive API documentation inline
- Long code examples inline
- Advanced techniques mixed with basics
- Everything in one file

### The Solution

**✅ Good Structure:**

```
skill-name/
├── SKILL.md  (1,800 words - core essentials only)
└── references/
    ├── patterns.md (2,500 words - detailed patterns)
    ├── advanced.md (3,700 words - advanced topics)
    └── api-reference.md (4,200 words - complete API docs)
```

**Why good:**
- ✅ Progressive disclosure - load details only when needed
- ✅ SKILL.md stays lean (fast to load)
- ✅ Detailed content available but not forced into context
- ✅ Claude loads references when it determines they're needed
- ✅ Easier to maintain and update

### How to Fix

**Refactoring process:**

1. **Identify long sections** - Find sections > 500 words in SKILL.md
2. **Categorize content** - What are the distinct topics?
3. **Extract to references** - Move detailed content to `references/topic.md`
4. **Keep summaries** - Leave brief overview in SKILL.md
5. **Add references section** - Point to the new files

**Example refactoring:**

**Before (all in SKILL.md):**
```markdown
# Hook Development

## Overview
[200 words]

## Hook Types
[800 words of detailed explanation]

## Implementation Patterns
[1,200 words of patterns]

## API Reference
[2,000 words of complete API]

## Advanced Techniques
[1,500 words of advanced topics]

## Troubleshooting
[800 words]

Total: 6,500 words
```

**After:**

**SKILL.md (1,800 words):**
```markdown
# Hook Development

## Overview
[200 words]

## Hook Types
[300 words - essential overview]

See `references/hook-types-detailed.md` for complete documentation.

## Implementation Patterns
[400 words - core patterns summary]

See `references/patterns.md` for detailed patterns and examples.

## Quick API Reference
[500 words - most common APIs]

See `references/api-reference.md` for complete API documentation.

## Getting Started
[400 words]

## Additional Resources

### Reference Files
- **`references/hook-types-detailed.md`** - Complete hook type documentation
- **`references/patterns.md`** - Detailed implementation patterns
- **`references/api-reference.md`** - Full API reference
- **`references/advanced.md`** - Advanced techniques
- **`references/troubleshooting.md`** - Common issues and solutions
```

**references/patterns.md (1,200 words):**
```markdown
# Hook Implementation Patterns

[All detailed patterns moved here]
```

**references/api-reference.md (2,000 words):**
```markdown
# Hook API Reference

[Complete API documentation moved here]
```

**references/advanced.md (1,500 words):**
```markdown
# Advanced Hook Techniques

[Advanced topics moved here]
```

**references/troubleshooting.md (800 words):**
```markdown
# Hook Troubleshooting

[Troubleshooting content moved here]
```

### Guidelines

**What stays in SKILL.md:**
- Purpose and overview (200-300 words)
- When to use skill (100-200 words)
- Core concepts summary (300-500 words)
- Quick reference (200-400 words)
- Getting started (300-500 words)
- Pointers to references (100-200 words)

**What moves to references/:**
- Detailed explanations (> 500 words per topic)
- Complete API documentation
- Advanced techniques
- Comprehensive examples with explanations
- Edge cases and troubleshooting
- Migration guides
- Historical context

## Mistake 3: Second Person Writing

### The Problem

**❌ Bad Examples:**

```markdown
You should start by reading the configuration file.
You need to validate the input before processing.
You can use the grep tool to search for patterns.
You might want to configure the settings first.
```

**Why bad:**
- Not imperative/infinitive form
- Sounds like advice to a person, not instructions for AI
- Less direct and actionable
- Doesn't match Claude skill conventions

### The Solution

**✅ Good Examples:**

```markdown
Start by reading the configuration file.
Validate the input before processing.
Use the grep tool to search for patterns.
Configure the settings first.
```

**Why good:**
- ✅ Imperative form (verb-first)
- ✅ Direct instructions
- ✅ Clear and actionable
- ✅ Matches skill writing conventions

### How to Fix

**Conversion patterns:**

| Second Person | Imperative Form |
|---------------|-----------------|
| You should X | To accomplish Y, do X |
| You need to X | X before Y |
| You can X | X is available for Y |
| You must X | X to ensure Y |
| You might want to X | X when Y |
| You would X | X for Y |

**Examples:**

**Before:**
```markdown
You should validate the YAML frontmatter before processing.
```
**After:**
```markdown
Validate the YAML frontmatter before processing.
```

---

**Before:**
```markdown
You need to extract code blocks that are longer than 10 lines.
```
**After:**
```markdown
Extract code blocks longer than 10 lines.
```

---

**Before:**
```markdown
You can use the Read tool to load the markdown file.
```
**After:**
```markdown
Use the Read tool to load the markdown file.
```

---

**Before:**
```markdown
You might want to check if the file exists first.
```
**After:**
```markdown
Check if the file exists before proceeding.
```

### Batch Find-and-Replace

Search for these patterns and fix:

```bash
# Find second-person patterns
grep -E "You (should|need|can|must|might|would|could)" SKILL.md

# Common patterns to replace
You should → [Remove or convert to imperative]
You need to → [Remove "You need to"]
You can → [Remove "You can"]
You must → [Remove "You must"]
```

## Mistake 4: Missing Resource References

### The Problem

**❌ Bad Structure:**

```markdown
# SKILL.md

## Purpose
[Content]

## How to Use
[Content]

## Details
[Content]

[... more content ...]

[No mention that references/ directory exists]
[No pointer to examples/]
[Claude doesn't know additional resources are available]
```

**Why bad:**
- Claude doesn't know references exist
- Can't load additional documentation when needed
- Resources go unused
- Defeats purpose of progressive disclosure

### The Solution

**✅ Good Structure:**

```markdown
# SKILL.md

## Purpose
[Content]

## How to Use
[Content]

## Core Concepts
[Brief summary]

See `references/detailed-concepts.md` for complete documentation.

## Quick Reference
[Essential info]

## Additional Resources

### Reference Files

For detailed information, consult:
- **`references/patterns.md`** - Detailed implementation patterns
- **`references/advanced.md`** - Advanced techniques and edge cases
- **`references/api-reference.md`** - Complete API documentation

### Example Files

Working examples in `examples/`:
- **`example-basic.py`** - Basic usage example
- **`example-advanced.js`** - Advanced implementation
- **`config-template.json`** - Configuration template

### Utility Scripts

Helper scripts in `scripts/`:
- **`validate.sh`** - Validate configuration
- **`test.py`** - Run tests
- **`process.sh`** - Process data
```

**Why good:**
- ✅ Claude knows what references exist
- ✅ Can load appropriate documentation when needed
- ✅ Clear descriptions of what each file contains
- ✅ Organized by resource type

### How to Fix

**Add references section template:**

```markdown
## Additional Resources

### Reference Files

[List each .md file in references/]
- **`references/filename.md`** - [What it contains]

### Example Files

[List each file in examples/]
- **`examples/filename.ext`** - [What it demonstrates]

### Utility Scripts

[List each script in scripts/]
- **`scripts/filename.sh`** - [What it does]

### Assets

[List key assets if applicable]
- **`assets/template/`** - [What it's for]
```

**Inline references:**

When mentioning a topic that has detailed documentation:

```markdown
## Hook Types

There are four main hook types: PreToolUse, PostToolUse, Stop, and SubagentStop.

See `references/hook-types.md` for complete documentation of each type.
```

## Mistake 5: Poor File Naming

### The Problem

**❌ Bad Names:**

```
skill-name/
├── references/
│   ├── ref1.md          (not descriptive)
│   ├── misc.md          (too vague)
│   └── stuff.md         (meaningless)
├── examples/
│   ├── example1.py      (not descriptive)
│   ├── test.js          (too generic)
│   └── code.txt         (wrong extension)
└── scripts/
    └── script.sh        (not descriptive)
```

**Why bad:**
- Can't tell what files contain without opening them
- Hard to reference in SKILL.md
- Difficult to maintain
- Poor discoverability

### The Solution

**✅ Good Names:**

```
skill-name/
├── references/
│   ├── authentication-patterns.md
│   ├── api-reference.md
│   └── troubleshooting-guide.md
├── examples/
│   ├── basic-auth-example.py
│   ├── oauth-flow.js
│   └── config-template.json
└── scripts/
    ├── validate-config.sh
    └── test-connection.py
```

**Why good:**
- ✅ Descriptive names indicate content
- ✅ Easy to reference in documentation
- ✅ Discoverable without opening files
- ✅ Proper extensions

### Naming Conventions

**Reference files:**
- Format: `topic-name.md` or `topic-category.md`
- Examples: `authentication-patterns.md`, `api-reference.md`, `advanced-techniques.md`
- Use: `patterns`, `reference`, `guide`, `advanced` as suffixes

**Example files:**
- Format: `description-of-example.extension`
- Examples: `basic-usage.py`, `oauth-example.js`, `config-template.json`
- Use proper language extensions: `.py`, `.js`, `.sh`, `.json`, `.yaml`

**Script files:**
- Format: `action-target.extension`
- Examples: `validate-config.sh`, `test-connection.py`, `parse-yaml.js`
- Use action verbs: `validate`, `test`, `parse`, `generate`, `process`

**Asset directories:**
- Format: `descriptive-name/`
- Examples: `hello-world-template/`, `brand-assets/`, `boilerplate/`

## Mistake 6: Incomplete Examples

### The Problem

**❌ Bad Examples:**

```python
# examples/example.py
# Incomplete - missing imports
result = process_data(data)
print(result)
```

```javascript
// examples/example.js
// Incomplete - missing context
const result = api.call()
```

**Why bad:**
- Can't run without modifications
- Missing setup/context
- No comments explaining what it does
- Users can't copy-paste and use

### The Solution

**✅ Good Examples:**

```python
# examples/authentication-example.py
"""
Demonstrates OAuth 2.0 authentication flow.

Requirements:
- pip install requests
- Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET environment variables

Usage:
    python authentication-example.py
"""
import os
import requests

# Configuration
CLIENT_ID = os.getenv('OAUTH_CLIENT_ID')
CLIENT_SECRET = os.getenv('OAUTH_CLIENT_SECRET')
TOKEN_URL = 'https://oauth.example.com/token'

def get_access_token():
    """Retrieve access token using client credentials flow."""
    response = requests.post(
        TOKEN_URL,
        auth=(CLIENT_ID, CLIENT_SECRET),
        data={'grant_type': 'client_credentials'}
    )
    response.raise_for_status()
    return response.json()['access_token']

if __name__ == '__main__':
    token = get_access_token()
    print(f'Access token: {token}')
```

**Why good:**
- ✅ Complete - all imports included
- ✅ Documented - purpose and requirements clear
- ✅ Runnable - can copy-paste and use (with setup)
- ✅ Commented - explains key parts
- ✅ Self-contained - has all necessary code

### How to Fix

**Example checklist:**

- [ ] All imports/requires included
- [ ] Configuration clearly marked
- [ ] Purpose documented at top
- [ ] Requirements listed (dependencies, env vars)
- [ ] Usage instructions provided
- [ ] Key sections commented
- [ ] Error handling included
- [ ] Example can run with minimal setup

## Mistake 7: No Progressive Disclosure

### The Problem

**❌ Bad Organization:**

```
skill-name/
└── SKILL.md (5,000 words - everything mixed together)
```

Content structure:
- Basics mixed with advanced topics
- API reference inline with getting started
- No clear progression
- Everything loaded always

**Why bad:**
- Overwhelming for simple use cases
- Forces advanced content into context unnecessarily
- Violates progressive disclosure principle
- Harder to navigate

### The Solution

**✅ Good Organization:**

```
skill-name/
├── SKILL.md (1,800 words - essentials)
│   ├── Purpose
│   ├── When to use
│   ├── Core concepts (summary)
│   ├── Quick reference
│   └── Pointers to references
└── references/
    ├── getting-started.md (Beginner level)
    ├── patterns.md (Intermediate level)
    ├── advanced.md (Advanced techniques)
    └── api-reference.md (Complete reference)
```

**Content progression:**

Level 1 (SKILL.md - always loaded):
- What is it?
- When to use?
- Core concepts (brief)
- Common tasks (summary)
- Where to find more info

Level 2 (references/getting-started.md - for beginners):
- Basic setup
- Simple examples
- Common patterns
- First steps

Level 3 (references/patterns.md - for regular use):
- Common patterns
- Best practices
- Typical workflows

Level 4 (references/advanced.md - for experts):
- Advanced techniques
- Edge cases
- Performance optimization
- Internals

Level 5 (references/api-reference.md - complete documentation):
- Complete API
- All options
- All parameters
- All methods

### How to Fix

**Reorganization process:**

1. **Audit current content** - What's in SKILL.md?
2. **Categorize by level** - Basic, intermediate, advanced, reference
3. **Extract by level** - Move to appropriate reference files
4. **Keep essentials** - Leave only core in SKILL.md
5. **Add progression** - Link from SKILL.md to references

## Summary Checklist

Before finalizing a skill, check for these mistakes:

### Description:
- [ ] ❌ Vague description → ✅ Specific trigger phrases in quotes
- [ ] ❌ Second person → ✅ Third person ("This skill should be used when...")
- [ ] ❌ No trigger phrases → ✅ 3-7 concrete user queries

### Content Organization:
- [ ] ❌ Everything in SKILL.md → ✅ Lean SKILL.md + detailed references/
- [ ] ❌ No progressive disclosure → ✅ Core → intermediate → advanced structure
- [ ] ❌ Mixed complexity levels → ✅ Clear progression

### Writing Style:
- [ ] ❌ Second person ("You should...") → ✅ Imperative form ("Do X to accomplish Y")
- [ ] ❌ Passive voice → ✅ Active, direct instructions

### Resource Organization:
- [ ] ❌ No reference to supporting files → ✅ Clear "Additional Resources" section
- [ ] ❌ Poor file names → ✅ Descriptive, kebab-case names
- [ ] ❌ Incomplete examples → ✅ Complete, runnable examples with documentation

### Structure:
- [ ] ❌ Missing directories → ✅ Only directories actually used
- [ ] ❌ Empty directories → ✅ Delete unused directories
- [ ] ❌ Inconsistent format → ✅ Follow standard structure

## Automated Fixes

Use the skill-reviewer agent to automatically detect and suggest fixes for common mistakes:

```bash
# In Claude Code
/review-skill skill-name
```

The agent will check:
- Description quality (triggers, person, specificity)
- Content organization (progressive disclosure, length)
- Writing style (imperative vs second person)
- Resource references (all files referenced)
- File naming (descriptive names)
- Example completeness

## Conclusion

Avoiding these common mistakes results in skills that:
- Trigger reliably with strong descriptions
- Load efficiently with progressive disclosure
- Provide clear, actionable instructions in imperative form
- Organize content logically with proper references
- Include complete, usable examples
- Follow consistent naming and structure conventions

Review this checklist when creating or updating skills to ensure quality and effectiveness.
