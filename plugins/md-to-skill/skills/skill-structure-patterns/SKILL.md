---
name: Claude Skill Structure Patterns
description: This skill should be used when the user asks to "create a Claude skill", "skill structure best practices", "skill frontmatter format", "generate trigger phrases", "progressive disclosure for skills", "organize skill references", or when converting content to Claude Code skills. Provides comprehensive patterns, templates, and examples for creating effective Claude skills.
version: 0.1.0
---

# Claude Skill Structure Patterns

## Purpose

Provide comprehensive patterns, templates, and best practices for creating effective Claude Code skills. This includes skill directory structure, frontmatter format, trigger phrase generation, progressive disclosure organization, and quality validation.

## When to Use

Use this skill when:
- Converting markdown content to Claude skills
- Creating new skills from scratch
- Validating skill structure and quality
- Generating skill frontmatter and descriptions
- Organizing content using progressive disclosure
- Determining trigger phrases for skill activation

## Skill Directory Structure

### Standard Structure

```
skill-name/
├── SKILL.md              # Required: Core skill content
├── references/           # Optional: Detailed documentation
│   ├── topic-1.md
│   ├── topic-2.md
│   └── advanced.md
├── examples/             # Optional: Working code examples
│   ├── example-1.py
│   ├── example-2.js
│   └── config.json
└── scripts/              # Optional: Utility scripts
    ├── validate.sh
    └── process.py
```

### Directory Purpose

**SKILL.md** (required):
- Core skill content
- Target: 1,500-2,000 words
- Maximum: 3,000 words (beyond this, use references/)
- Always loaded when skill triggers

**references/** (optional):
- Detailed documentation by topic
- Loaded on-demand by Claude
- Each file: 800-2,500 words
- Use for: API docs, advanced techniques, troubleshooting

**examples/** (optional):
- Complete, runnable code examples
- Configuration files
- Template files
- Users can copy and adapt directly

**scripts/** (optional):
- Validation utilities
- Automation helpers
- Parsing tools
- Testing scripts

## SKILL.md Format

### Required Frontmatter

```yaml
---
name: Descriptive Skill Name
description: This skill should be used when the user asks to "specific phrase 1", "specific phrase 2", "specific phrase 3", or mentions "key concept". Brief explanation of what skill provides.
version: 0.1.0
---
```

**Frontmatter fields:**
- `name`: Human-readable skill name (Title Case)
- `description`: Third-person, with specific trigger phrases (critical for activation)
- `version`: Semantic versioning (0.1.0, 1.0.0, etc.)

### Description Best Practices

**Must use third person:**
✅ "This skill should be used when..."
❌ "Use this skill when..."
❌ "You should load this skill when..."

**Must include specific trigger phrases:**
✅ `"create a hook"`, `"add a PreToolUse hook"`, `"validate tool use"`
❌ "working with hooks"
❌ "hook-related tasks"

**Use concrete user queries:**
- Think: "What would a user literally say?"
- Include 3-5 specific phrases in quotes
- Add key concepts or terminology

**Example - Strong Description:**
```yaml
description: This skill should be used when the user asks to "create a hook", "add a PreToolUse hook", "validate tool use", "implement prompt-based hooks", or mentions hook events (PreToolUse, PostToolUse, Stop). Provides comprehensive hooks API guidance.
```

**Example - Weak Description:**
```yaml
description: Provides guidance for working with hooks.
```

### Body Writing Style

**Use imperative/infinitive form (verb-first):**
✅ "To create a skill, start with the directory structure."
✅ "Parse the markdown file using Read tool."
✅ "Extract code blocks larger than 10 lines."

**Avoid second person:**
❌ "You should create a skill..."
❌ "You need to parse the markdown..."
❌ "You can extract code blocks..."

**Be objective and instructional:**
✅ "Configure the setting before use."
✅ "Validate input to ensure correctness."
❌ "You might want to configure..."
❌ "It's recommended that you validate..."

## Progressive Disclosure Strategy

### Three-Tier Loading System

Claude skills use progressive disclosure to manage context:

1. **Metadata (always loaded)** - ~100 words
   - Skill name and description from frontmatter
   - Used for skill selection and activation

2. **SKILL.md body (loaded when triggered)** - 1,500-2,000 words
   - Core concepts and procedures
   - Quick reference
   - Pointers to references/examples/scripts

3. **Bundled resources (loaded as needed)** - Unlimited
   - references/: Detailed documentation
   - examples/: Working code
   - scripts/: Utilities (may execute without loading)

### Content Distribution

**Put in SKILL.md:**
- Purpose and when to use skill
- Core concepts (essential knowledge)
- Step-by-step procedures
- Quick reference tables
- File structure overview
- Pointers to references/examples/scripts
- Most common use cases

**Move to references/:**
- Detailed patterns and techniques
- Advanced use cases
- Comprehensive API documentation
- Migration guides
- Edge cases and troubleshooting
- Historical context
- Extensive examples with explanations

**Move to examples/:**
- Complete, runnable code
- Configuration files
- Template files
- Real-world implementations
- Before/after comparisons

**Move to scripts/:**
- Validation utilities
- Testing helpers
- Automation tools
- Parsing utilities

### Referencing Resources

Always reference supporting files in SKILL.md:

```markdown
## Additional Resources

### Reference Files

For detailed information, consult:
- **`references/patterns.md`** - Common implementation patterns
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
```

## Trigger Phrase Generation

### How Trigger Phrases Work

Claude uses trigger phrases in skill descriptions to determine when to load a skill. Strong phrases are:
- Specific and concrete
- Action-oriented (verbs)
- What users actually say
- Include domain terminology

### Phrase Categories

**Action phrases (verbs):**
- "create", "build", "generate", "convert"
- "parse", "analyze", "extract", "split"
- "validate", "check", "verify", "test"
- "configure", "setup", "initialize"

**Domain concepts:**
- Technical terms users would mention
- Tool names, file types, frameworks
- Specific features or components

**Task descriptions:**
- "convert markdown to skill"
- "extract code blocks"
- "split by sections"

### Generation Process

For a skill about converting markdown to Claude skills:

**Step 1: Identify key actions**
- Convert, parse, extract, split, organize

**Step 2: Identify domain terms**
- Markdown, skill, SKILL.md, references, examples

**Step 3: Combine into phrases**
- "convert markdown to skill"
- "parse markdown"
- "extract code blocks"
- "split markdown by sections"
- "organize skill content"

**Step 4: Add variations**
- "create skill from markdown"
- "markdown to SKILL.md"
- "analyze markdown structure"

**Step 5: Select 5-7 best phrases**
- Most specific
- Most likely to be said
- Cover different aspects

### Trigger Phrase Templates

Use these templates for generating triggers:

**For creation tasks:**
- "create [X]"
- "build [X]"
- "generate [X] from [Y]"
- "convert [Y] to [X]"

**For analysis tasks:**
- "parse [X]"
- "analyze [X] structure"
- "extract [Y] from [X]"
- "identify [Y] in [X]"

**For validation tasks:**
- "validate [X]"
- "check [X] quality"
- "verify [X] structure"
- "test [X]"

**For configuration tasks:**
- "configure [X]"
- "setup [X]"
- "organize [X]"

## Quality Validation

### SKILL.md Quality Checks

**Description quality:**
- ✅ Uses third person ("This skill should be used when...")
- ✅ Includes 3-7 specific trigger phrases in quotes
- ✅ Mentions key domain concepts
- ✅ Explains what skill provides (1-2 sentences after triggers)

**Content organization:**
- ✅ Has clear purpose section
- ✅ Explains when to use skill
- ✅ Provides step-by-step procedures
- ✅ References supporting files (if they exist)
- ✅ Stays within 3,000 words (ideally 1,500-2,000)

**Writing style:**
- ✅ Uses imperative/infinitive form (verb-first)
- ✅ Avoids second person ("you")
- ✅ Objective and instructional
- ✅ Clear and concise

**Structure:**
- ✅ Logical heading hierarchy (H2, H3 levels)
- ✅ Scannable (lists, tables, code blocks)
- ✅ Progressive flow (overview → details → summary)

### Progressive Disclosure Check

**Is SKILL.md lean enough?**
- Word count < 3,000 (ideally 1,500-2,000)
- Contains only essential information
- Pointers to references/ for details
- No duplicate content across files

**Are references/ organized well?**
- Each file focuses on one topic
- Files are 800-2,500 words each
- Descriptive file names
- Referenced in SKILL.md

**Are examples/ complete?**
- Code is runnable without modification (or with minimal setup)
- Includes necessary configuration
- Comments explain key parts
- File names describe what they demonstrate

### Auto-Fix Strategies

When quality issues detected:

**Weak trigger phrases:**
- Analyze content to identify key actions
- Extract domain terminology
- Generate specific phrases from content
- Replace vague phrases with concrete ones

**Too long SKILL.md:**
- Identify sections > 500 words
- Move detailed content to references/
- Keep summaries and overviews in SKILL.md
- Add references section pointing to new files

**Poor structure:**
- Add missing headings
- Reorganize content logically
- Create hierarchy (H2 for major sections, H3 for subsections)
- Add summary sections

**Second-person writing:**
- Convert "You should X" → "To accomplish Y, do X"
- Convert "You can X" → "X is available for Y"
- Convert "You need to X" → "X before Y"

## Naming Conventions

### Skill Directory Names

**Format:** kebab-case (lowercase with hyphens)

**Good examples:**
- `api-integration-guide`
- `markdown-parsing`
- `database-migration-tools`
- `frontend-component-patterns`

**Bad examples:**
- `API_Integration` (not kebab-case)
- `markdownparsing` (no separators)
- `db-mig-tools` (over-abbreviated)

**Generation from content:**
1. Extract main topic from H1 or filename
2. Convert to lowercase
3. Replace spaces/underscores with hyphens
4. Remove special characters
5. Keep 2-4 words (be descriptive but concise)

### Reference File Names

**Format:** kebab-case, descriptive

**Good examples:**
- `authentication-patterns.md`
- `error-handling-guide.md`
- `api-reference.md`
- `advanced-techniques.md`

**Bad examples:**
- `ref1.md` (not descriptive)
- `Authentication Patterns.md` (spaces, not kebab-case)
- `misc.md` (too vague)

**Generation from section headings:**
1. Use H2 heading text as basis
2. Convert to kebab-case
3. Add category if helpful (guide, reference, patterns)

### Example File Names

**Format:** descriptive + language extension

**Good examples:**
- `authentication-example.py`
- `api-request.js`
- `config-template.json`
- `basic-usage.sh`

**Bad examples:**
- `example1.py` (not descriptive)
- `test.js` (too vague)
- `code.txt` (wrong extension)

## Content Organization Patterns

### Pattern 1: Simple Topic

**When:** Single cohesive topic, < 2,000 words

**Structure:**
```
skill-name/
└── SKILL.md
```

**SKILL.md contains:**
- All content (no separate references needed)
- Code examples inline (if small)
- Self-contained knowledge

### Pattern 2: Topic with Details

**When:** Core topic with detailed sub-topics, 2,000-5,000 words

**Structure:**
```
skill-name/
├── SKILL.md
└── references/
    ├── topic-details.md
    └── advanced.md
```

**SKILL.md contains:**
- Overview and core concepts (1,500-2,000 words)
- Pointers to references/

**references/ contains:**
- Detailed documentation per topic
- Advanced techniques
- Troubleshooting

### Pattern 3: Complete Skill Package

**When:** Complex domain with examples and utilities, > 5,000 words

**Structure:**
```
skill-name/
├── SKILL.md
├── references/
│   ├── patterns.md
│   ├── api-reference.md
│   └── advanced.md
├── examples/
│   ├── basic-example.py
│   └── advanced-example.js
└── scripts/
    └── validate.sh
```

**SKILL.md contains:**
- Overview (purpose, when to use)
- Core concepts
- Quick reference
- File structure overview
- Pointers to all resources

**references/ contains:**
- Detailed patterns and techniques
- Complete API documentation
- Advanced topics

**examples/ contains:**
- Working code examples
- Configuration templates
- Real-world use cases

**scripts/ contains:**
- Validation utilities
- Testing helpers
- Automation tools

## Templates

For complete templates and examples, see:
- **`references/skill-template.md`** - Fill-in-the-blank SKILL.md template
- **`references/description-templates.md`** - Trigger phrase templates by category
- **`examples/simple-skill/`** - Complete simple skill example
- **`examples/complex-skill/`** - Complete complex skill example

## Summary

Creating effective Claude skills requires:

1. **Strong trigger descriptions** - Third person, specific phrases, concrete scenarios
2. **Progressive disclosure** - Lean SKILL.md (1,500-2,000 words), detailed references/
3. **Imperative writing style** - Verb-first instructions, no second person
4. **Clear organization** - Logical structure, referenced resources
5. **Quality validation** - Check description, content, style, structure
6. **Proper naming** - Kebab-case, descriptive names

Focus on making skills easy to trigger (strong phrases), quick to load (lean SKILL.md), and comprehensive when needed (well-organized references/).

## Additional Resources

### Comprehensive Guides

For step-by-step workflows and detailed guidance:
- **`references/skill-creation-process.md`** - Complete 6-step process for creating skills from understanding to iteration, with real examples from production skills
- **`references/common-mistakes.md`** - Catalog of 7 common mistakes with before/after examples and fix strategies

### Templates and Patterns

For templates and format references:
- **`references/skill-template.md`** - Fill-in-the-blank SKILL.md template
- **`references/description-templates.md`** - Trigger phrase templates by category

### Working Examples

For real-world skill examples:
- **`examples/simple-skill/`** - Complete simple skill example
- **`examples/complex-skill/`** - Complete complex skill example with references/, examples/, and scripts/

### Progressive Disclosure Deep Dive

The skill creation process reference includes:
- Three-tier loading system with context costs
- Anatomy of a skill (what goes where)
- Resource planning strategies
- Content organization patterns
- Validation and testing procedures
- Iteration workflows

### Common Pitfalls

The common mistakes reference covers:
- Weak trigger descriptions (with fixes)
- Too much content in SKILL.md (refactoring guide)
- Second-person writing (conversion patterns)
- Missing resource references (templates)
- Poor file naming (conventions)
- Incomplete examples (completion checklist)
- No progressive disclosure (reorganization process)
