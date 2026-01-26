# md-to-skill

Convert LLM-generated markdown files into organized Claude Code skills with automatic structure analysis, quality validation, and intelligent content merging.

## Overview

Transform unstructured markdown content from ChatGPT, Claude, or manual creation into properly organized Claude skills with:
- Automatic content analysis and structure generation
- Smart code block extraction to `examples/`
- Topic-based content splitting into `references/`
- Auto-generated frontmatter with trigger phrases
- Quality validation and improvement
- Intelligent merging with existing skills

## Features

### 🔄 Convert Single Files
- Parse any markdown file into a Claude skill
- Auto-generate skill names with user selection
- Ask for save location (user scope or project scope)
- Merge with existing skills when names conflict
- Optional cleanup of source markdown files

### 🔍 Learn from Context
- Scan directory for potential skills
- Filter by topic with optional parameter
- Smart detection of skill-worthy content
- Batch conversion with user selection
- Track and merge related content

### 🎯 Intelligent Processing
- Extract code blocks (>10 lines) to `examples/`
- Split content by topics into `references/`
- Generate quality trigger phrases
- Auto-fix structure issues
- Preserve inline code snippets

### 🔗 Smart Merging
- Detect existing skills by name
- Notify before merging content
- Combine related knowledge bases
- Iterative skill improvement workflow

## Installation

### From Marketplace
```bash
/plugin marketplace add AndaAndaman/claude-plugins
/plugin install md-to-skill
```

### Local Development
```bash
# Clone repository
git clone https://github.com/AndaAndaman/claude-plugins.git
cd claude-plugins

# Test plugin
claude --plugin-dir ./plugins/md-to-skill

# Install to user scope
cp -r plugins/md-to-skill ~/.claude-plugins/

# Install to project
cp -r plugins/md-to-skill /path/to/project/.claude/
```

## Usage

### Convert Single Markdown File

```bash
/convert-to-skill path/to/file.md
```

**Workflow:**
1. Analyzes markdown structure
2. Generates 3 name suggestions based on content
3. Asks user to select preferred name
4. Asks for save location (user scope ~/.claude-plugins/ or project scope ./.claude/)
5. Checks for existing skill with same name
6. If exists: Shows preview and asks to merge
7. If new: Creates skill structure directly
8. Asks permission to clean/delete source .md file

**Example:**
```
> /convert-to-skill api-documentation.md

Analyzing markdown content...

Suggested skill names:
1. api-integration-guide (Recommended)
2. rest-api-patterns
3. api-documentation

Select skill name (1-3): 1

Save location:
1. User scope (~/.claude-plugins/skills/)
2. Project scope (./.claude/skills/)

Select location (1-2): 2

✓ Skill created at ./.claude/skills/api-integration-guide/
  - SKILL.md (1,850 words)
  - references/authentication.md
  - references/error-handling.md
  - examples/request-example.js
  - examples/response-handler.py

Delete source file api-documentation.md? (y/n): y
✓ Source file removed
```

### Learn from Context

```bash
# Scan all markdown files in current directory
/learn-skill

# Filter by topic
/learn-skill authentication
```

**Workflow:**
1. Scans directory for .md files and files they reference
2. Analyzes content to detect potential skills
3. Shows list of candidates with confidence scores
4. User selects which to convert
5. Processes each selected file with same workflow as `/convert-to-skill`

**Example:**
```
> /learn-skill authentication

Scanning directory for potential skills...

Found 5 markdown files, 3 are skill candidates:

1. oauth-guide.md (95% confidence) - 2,400 words
   Topics: OAuth 2.0, JWT tokens, refresh flows

2. security-patterns.md (88% confidence) - 1,800 words
   Topics: Authentication, authorization, session management

3. api-security.md (76% confidence) - 1,200 words
   Topics: API keys, rate limiting, security headers

Select files to convert (comma-separated, e.g. 1,3): 1,2

Converting oauth-guide.md...
[... conversion workflow ...]

Converting security-patterns.md...
Existing skill "security-patterns" found!
Preview changes:
  - Add new section: Multi-factor Authentication
  - New reference: session-security.md
  - Merge with existing OAuth content

Merge with existing skill? (y/n): y
✓ Skill updated and improved
```

## How It Works

### Content Analysis
1. **Structure Detection**: Identifies headings, sections, subsections
2. **Code Extraction**: Finds code blocks, determines if >10 lines for extraction
3. **Topic Identification**: Analyzes content to identify distinct topics
4. **Quality Assessment**: Checks for completeness, examples, clarity

### Skill Generation
1. **Name Generation**: Creates 3 relevant name options using content analysis
2. **Frontmatter Creation**: Generates description and trigger phrases
3. **Content Organization**:
   - Main content → `SKILL.md` (1,500-2,000 words, progressive disclosure)
   - Detailed topics → `references/` (topic-specific markdown files)
   - Large code blocks → `examples/` (executable examples)
   - Small snippets → Inline in SKILL.md
4. **Quality Validation**: Auto-fixes structure, improves trigger phrases

### Smart Merging
When existing skill detected:
1. Analyze both existing and new content
2. Identify overlapping vs. unique sections
3. Show preview of changes (additions, updates, merges)
4. User approves or cancels
5. Intelligently combine content:
   - Deduplicate similar sections
   - Preserve existing structure
   - Add new topics to references/
   - Merge code examples
   - Update frontmatter if needed

## Best Practices

### Input Markdown
- Clear heading hierarchy (H1 → H2 → H3)
- Descriptive headings that indicate topics
- Code blocks with language tags
- Logical content flow

### Iterative Improvement
1. Convert initial markdown → skill
2. Use skill and gather feedback
3. Generate updated markdown from LLM
4. Run `/convert-to-skill` again → merges improvements
5. Repeat to continuously enhance skill quality

### Topic Organization
The plugin automatically splits content when it detects:
- Multiple distinct topics (>3 level-2 headings)
- Long sections (>800 words)
- Self-contained subsections with examples

## Configuration

No configuration required. The plugin works out of the box with sensible defaults.

## Components

### Commands
- **convert-to-skill** - Convert single markdown file to skill
- **learn-skill** - Scan context and batch convert

### Agent
- **skill-builder** - Autonomous agent for markdown analysis, structure generation, and quality validation

### Skills
- **markdown-parsing** - Techniques for parsing markdown structure
- **skill-structure-patterns** - Best practices, templates, and examples for Claude skills

## Troubleshooting

**Plugin not loading:**
- Verify installation: `ls ~/.claude-plugins/md-to-skill/` or `ls .claude/md-to-skill/`
- Check plugin.json exists: `cat ~/.claude-plugins/md-to-skill/.claude-plugin/plugin.json`
- Restart Claude Code session

**Commands not appearing:**
- Run `/help` to see all available commands
- Ensure commands are in `commands/` directory
- Check command markdown files have proper frontmatter

**Skill-builder agent not triggering:**
- This agent only triggers via explicit commands, not proactively
- Ensure you're using `/convert-to-skill` or `/learn-skill` commands

**Quality issues in generated skills:**
- The plugin auto-fixes most issues
- For complex content, it may ask for user guidance
- Run conversion again to iteratively improve

**Merge conflicts:**
- Review preview carefully before approving merge
- Cancel merge if preview doesn't look right
- Manually edit skill after merge if needed

## Examples

See `skills/skill-structure-patterns/examples/` for real examples of:
- Well-structured SKILL.md files
- Progressive disclosure format
- Quality trigger phrases
- Reference organization

## Contributing

This plugin is part of the FlowAccount Developer Tools plugin marketplace. To contribute:

1. Fork the repository
2. Create feature branch
3. Test changes locally with `claude --plugin-dir ./plugins/md-to-skill`
4. Submit pull request

## License

MIT

## Version History

### 0.1.0 (Initial Release)
- `/convert-to-skill` command for single file conversion
- `/learn-skill` command for context-based batch conversion
- skill-builder agent with intelligent processing
- markdown-parsing skill
- skill-structure-patterns skill
- Smart merging with existing skills
- Auto-generated name suggestions
- Quality validation and auto-fix
- Code block extraction (>10 lines)
- Topic-based content splitting
