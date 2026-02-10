---
name: markdown-parsing
description: This skill should be used when the user asks to "parse markdown", "extract markdown structure", "split markdown by headings", "detect code blocks in markdown", "analyze markdown content", or when converting markdown files to Claude skills. Provides techniques for analyzing and extracting structured content from markdown files.
---

# Markdown Parsing for Skill Conversion

## Purpose

Parse and analyze markdown files to extract structured content for organizing into Claude skills. This includes identifying heading hierarchies, extracting sections, detecting code blocks, and determining content organization patterns.

## When to Use

Use this skill when:
- Converting markdown files to Claude skills
- Analyzing markdown structure to determine how to split content
- Extracting code blocks from markdown for examples/
- Identifying topics and sections for references/
- Determining if markdown content is suitable for a skill

## Core Parsing Techniques

### Heading Hierarchy Detection

Markdown uses `#` symbols to denote heading levels:

```
# Level 1 (H1)
## Level 2 (H2)
### Level 3 (H3)
```

**Parse heading levels:**
- H1: Main topic (skill name candidate)
- H2: Major sections (potential references/ files)
- H3: Subsections (organize within references)

**Extraction approach:**
1. Scan for lines starting with `#`
2. Count `#` symbols to determine level
3. Extract heading text (everything after `#` symbols)
4. Map content between headings to sections

**Example patterns:**
- Single H1 + multiple H2s → Skill with references/
- Multiple H1s → Multiple potential skills
- Deep nesting (H4+) → May need restructuring

### Code Block Detection

Code blocks use triple backticks with optional language tags:

````markdown
```python
def example():
    pass
```
````

**Detection patterns:**
- Start delimiter: ````` optionally followed by language (python, javascript, bash, etc.)
- End delimiter: `````
- Content: Everything between delimiters

**Extraction criteria:**
- Count lines in code block
- If > 10 lines: Extract to examples/
- If ≤ 10 lines: Keep inline in SKILL.md or references/

**Language detection:**
- Check text immediately after opening ```
- Common: python, javascript, typescript, bash, json, yaml, markdown
- Use for filename extension (example.py, example.js, etc.)

**Inline code:**
- Single backticks: `code`
- Always keep inline, never extract

### Section Extraction

Extract content between headings as logical sections:

**Algorithm:**
1. Identify all headings with their levels and positions
2. Content from one heading to the next belongs to that section
3. Include subsections in parent section content
4. Track section depth for hierarchical organization

**Section metadata to capture:**
- Heading text (section name)
- Heading level (1-6)
- Line range (start to end)
- Word count
- Code blocks within section
- Subsection count

**Use section data to determine:**
- Which sections go to SKILL.md (core, overview)
- Which become references/ files (detailed, specific topics)
- How to name reference files (based on heading text)

### Content Type Recognition

Identify content types to determine organization:

**Instructional content (SKILL.md candidates):**
- Step-by-step procedures
- "How to" sections
- Workflow descriptions
- Quick reference tables
- Getting started guides

**Reference content (references/ candidates):**
- API documentation
- Detailed specifications
- Comprehensive lists
- Technical deep-dives
- Historical context
- Troubleshooting guides

**Example content (examples/ candidates):**
- Working code samples
- Configuration files
- Template files
- Real-world use cases

**Recognition patterns:**
- Procedural language: "First", "Then", "Next", "To do X"
- Reference language: "Available", "Specification", "Reference", "Details"
- Example language: "Example:", "Sample:", "Here's how"

## Markdown Structure Analysis

### Complexity Assessment

Determine if markdown is suitable for skill conversion:

**Simple structure (easy conversion):**
- Clear heading hierarchy
- Well-organized sections
- Code blocks with language tags
- Logical content flow

**Complex structure (needs user guidance):**
- Flat structure (no clear hierarchy)
- Mixed content types within sections
- Unclear topic boundaries
- Missing language tags on code blocks

**Poor structure (ask user for guidance):**
- No headings or minimal headings
- Stream of consciousness writing
- Unrelated topics mixed together
- Excessive nesting (H5, H6 levels)

### Topic Identification

Determine distinct topics for organizing into references/:

**Single topic indicators:**
- One main H1 heading
- All H2s relate to same topic
- Cohesive narrative flow
- < 2,000 words total

**Multiple topic indicators:**
- Multiple H1 headings
- H2s cover distinct subjects
- Self-contained sections
- > 3,000 words total

**Topic splitting approach:**
1. Identify major topics (usually H2 level)
2. Group related subsections
3. Evaluate topic independence
4. Consider if topics can be separate reference files

## Content Organization Strategies

### Progressive Disclosure Mapping

Map markdown content to Claude skill structure:

**SKILL.md gets:**
- First 3-4 paragraphs (overview)
- Core concepts section
- Quick reference tables
- Pointers to references/
- Most common use cases
- Target: 1,500-2,000 words

**references/ gets:**
- Detailed sections by topic
- Advanced techniques
- Comprehensive documentation
- Edge cases and troubleshooting
- Each file: 800-2,500 words

**examples/ gets:**
- Code blocks > 10 lines
- Complete, runnable examples
- Configuration files
- Template files

### Section-to-File Mapping

Determine which sections become which files:

**H1 heading → Skill name:**
- Use as basis for skill directory name
- Convert to kebab-case
- Remove special characters

**H2 headings → Reference files:**
- Each major H2 → Separate reference file
- Group small H2s into single reference
- File naming: kebab-case of heading text

**Code blocks → Example files:**
- Extract blocks > 10 lines
- Name: descriptive + language extension
- Keep smaller blocks inline

**Example mapping:**
```
# API Integration Guide (H1)
  → Skill name: api-integration-guide

## Authentication (H2)
  → references/authentication.md

## Error Handling (H2)
  → references/error-handling.md

## Rate Limiting (H2)
  → references/rate-limiting.md

```python (50 lines)
  → examples/auth-example.py
```

### Name Generation

Generate skill name options from content:

**Sources for names:**
1. H1 heading (most reliable)
2. Document title or frontmatter
3. File name (if descriptive)
4. Dominant keywords in content

**Name processing:**
- Convert to kebab-case
- Remove special characters
- Use 2-4 words
- Make descriptive and specific

**Generate 3 options:**
1. Direct from H1 (if exists)
2. Topic-based (key concepts)
3. Function-based (what it teaches)

## Parsing Workflow

### Step 1: Initial Scan

Read entire markdown file and capture:
- All headings with levels and positions
- All code blocks with languages and line counts
- Word count per section
- Overall structure complexity

### Step 2: Structure Analysis

Evaluate:
- Heading hierarchy (flat vs nested)
- Section sizes (balanced vs unbalanced)
- Topic count (single vs multiple)
- Code distribution (few vs many blocks)

### Step 3: Organization Decision

Determine:
- Skill name candidates (3 options)
- Which sections → SKILL.md
- Which sections → references/ (and filenames)
- Which code blocks → examples/ (and filenames)

### Step 4: Content Extraction

Extract and organize:
- Core content for SKILL.md (target 1,500-2,000 words)
- Reference content by topic
- Code examples > 10 lines
- Preserve inline code and small snippets

### Step 5: Quality Check

Verify:
- SKILL.md is lean and focused
- Reference files are well-organized
- Examples are complete and runnable
- All content accounted for (no orphans)

## Edge Cases

### Mixed Content Types

When section contains both instructional and reference material:
- Split at subsection level
- Keep instructions in SKILL.md
- Move detailed reference to references/

### Unclear Boundaries

When unclear where one topic ends and another begins:
- Default to keeping together
- Ask user for guidance
- Use word count as tie-breaker (>800 words → separate reference)

### Missing Structure

When markdown has minimal or no headings:
- Attempt to infer structure from content
- Look for section breaks (horizontal rules, blank lines)
- Ask user to clarify organization

### Language Ambiguity

When code blocks lack language tags:
- Attempt to infer from syntax
- Check for common patterns (def/class → Python, function/const → JavaScript)
- Use generic .txt extension if uncertain

## Implementation Notes

### Tools to Use

- **Read tool**: Load markdown file content
- **Grep tool**: Search for specific patterns (headings, code blocks)
- **Regex patterns**: Extract structured elements
- **Line-by-line parsing**: For detailed analysis

### Performance Considerations

- For large files (>5,000 words): Parse in chunks
- Use streaming approach for very long markdown
- Cache heading positions for multiple passes

### Preservation

- Maintain formatting within code blocks
- Preserve inline formatting (bold, italic, links)
- Keep tables intact
- Retain list structures

## Summary

Markdown parsing for skill conversion involves:
1. Detecting heading hierarchy and structure
2. Extracting code blocks with size/language
3. Identifying sections and topics
4. Recognizing content types (instructional vs reference vs example)
5. Mapping content to Claude skill structure (SKILL.md, references/, examples/)
6. Generating appropriate filenames from content

Focus on progressive disclosure: keep SKILL.md lean, extract detailed content to references/, and isolate code examples for reusability.
