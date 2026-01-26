---
name: learn-skill
description: Scan directory for potential skills and batch convert selected files
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
  - AskUserQuestion
  - Task(skill-builder)
arguments:
  - name: topic
    description: Optional topic to filter potential skills
    required: false
argument-hint: [optional-topic]
---

# Learn Skill Command

Scan the current directory for markdown files that could become Claude skills, intelligently detect skill-worthy content, and batch convert selected files.

## Purpose

This command automates skill discovery by:
- Scanning directory for .md files and referenced files
- Analyzing content to detect skill candidates
- Filtering by topic if specified
- Showing selection list with confidence scores
- Batch converting selected files using skill-builder agent

## Execution Workflow

### Step 1: Scan Directory

Find all markdown files in current directory:

```
Use Glob to find: **/*.md
```

**Scan scope:**
- All .md files in current directory (non-recursive by default)
- Files referenced by scanned .md files (check for markdown links)
- Exclude: node_modules/, .git/, build/, dist/

**Output:** List of candidate markdown files

### Step 2: Analyze Content

For each markdown file, analyze to determine if it's a potential skill:

**Detection criteria (combination):**
1. **Size**: File has >500 words (substantial content)
2. **Structure**: Has heading hierarchy (H1, H2 levels present)
3. **Content type**: Contains instructional/reference material (not just logs or notes)
4. **Completeness**: Has introduction, body, examples/conclusion

**Confidence scoring:**
- 90-100%: Excellent structure, clear topic, substantial content
- 75-89%: Good structure, decent content, minor gaps
- 60-74%: Acceptable structure, might need work
- <60%: Weak candidate (exclude from list)

**Exclude automatically:**
- README.md, CHANGELOG.md, LICENSE.md (standard files)
- Files with <200 words (too short)
- Files with no headings (unstructured)
- Build outputs, logs, generated files

### Step 3: Filter by Topic (Optional)

If user provided `[topic]` parameter:

**Filter files:**
- Content mentions topic keyword
- Heading contains topic
- Filename includes topic
- Referenced files discuss topic

**Influence organization:**
- Use topic for skill naming
- Organize references/ with topic prefix
- Emphasize topic-related sections in SKILL.md

**Example:**
```
/learn-skill authentication
```
Would filter to files mentioning "authentication", "auth", "login", etc.

### Step 4: Show Selection List

Present candidates to user with:
- File name
- Confidence score (percentage)
- Word count
- Detected topics (2-3 main topics from content)

**Format:**
```
Found 5 markdown files, 3 are skill candidates:

1. oauth-implementation.md (95% confidence) - 2,400 words
   Topics: OAuth 2.0, JWT tokens, refresh flows

2. api-error-handling.md (88% confidence) - 1,800 words
   Topics: Error handling, status codes, retry logic

3. database-patterns.md (76% confidence) - 1,200 words
   Topics: Database, migrations, queries

Select files to convert (comma-separated, e.g. 1,3): _
```

### Step 5: Batch Conversion

For each selected file:

1. Launch skill-builder agent using `Task(skill-builder)`
2. Agent performs full conversion workflow:
   - Name generation (3 options)
   - Scope selection
   - Conflict handling
   - Quality validation
   - Optional cleanup

3. Process files sequentially (wait for each to complete)

4. Show summary after all conversions complete:
   ```
   ✓ Converted 3 files into skills:
   - oauth-implementation → oauth-integration-guide
   - api-error-handling → api-error-patterns (merged with existing)
   - database-patterns → database-migration-tools

   Skills created at: ~/.claude-plugins/skills/
   ```

## User Interaction

For each selected file, skill-builder agent asks:
1. Select skill name (3 options)
2. Choose scope (user/project)
3. Approve merge (if conflict detected)
4. Clean source file (y/n)

**Note:** User answers questions for each file in sequence.

## Topic Parameter

### Without Topic

```
/learn-skill
```

Scans all .md files, shows all candidates above 60% confidence threshold.

### With Topic

```
/learn-skill authentication
```

**Filtering:**
- Only shows files related to authentication
- Confidence boost for files with topic in title
- Filters out unrelated files

**Organization influence:**
- Skill names prioritize topic keyword
- References/ organized with topic context
- Frontmatter emphasizes topic

**Topic matching (case-insensitive):**
- Exact match in filename
- Heading contains keyword
- Content mentions keyword 5+ times
- Related terms (e.g., "auth" matches "authentication")

## Reference File Detection

When scanning .md files, also check for referenced files:

**Markdown link patterns:**
```markdown
[Link text](./other-file.md)
[Link text](../docs/reference.md)
[Link text](subdir/example.md)
```

**Process:**
1. Extract all markdown links from scanned files
2. Resolve relative paths
3. Check if referenced file exists
4. Include in scan if .md extension
5. Analyze as potential skill or reference material

**Use case:**
- Main file: `guide.md` → Becomes SKILL.md
- Referenced files: `detail-1.md`, `detail-2.md` → Become references/

## Confidence Calculation

**Scoring algorithm:**

**Size (0-25 points):**
- <500 words: 0 points
- 500-1000 words: 10 points
- 1000-2000 words: 20 points
- >2000 words: 25 points

**Structure (0-25 points):**
- No headings: 0 points
- Only H1 or H2: 10 points
- H1 + multiple H2: 20 points
- Clear hierarchy (H1, H2, H3): 25 points

**Content type (0-30 points):**
- Instructional content detected: +15 points
- Code blocks present: +10 points
- Examples/patterns included: +5 points

**Completeness (0-20 points):**
- Has introduction: +5 points
- Has conclusion/summary: +5 points
- Has examples: +5 points
- Logical flow: +5 points

**Total:** Sum all points = confidence percentage

## Examples

### Basic Scan

```
> /learn-skill

Scanning directory for potential skills...

Found 8 markdown files, 4 are skill candidates:

1. react-hooks-guide.md (92% confidence) - 2,100 words
   Topics: React hooks, useState, useEffect, custom hooks

2. testing-patterns.md (87% confidence) - 1,650 words
   Topics: Unit testing, integration testing, mocking

3. git-workflow.md (79% confidence) - 1,200 words
   Topics: Git branching, commits, pull requests

4. deployment-checklist.md (68% confidence) - 950 words
   Topics: Deployment, CI/CD, production

Select files to convert (comma-separated, e.g. 1,3 or 'all'): 1,2

Converting react-hooks-guide.md...
[... skill-builder agent workflow ...]

Converting testing-patterns.md...
[... skill-builder agent workflow ...]

✓ Conversion complete!
  - react-hooks-guide → react-hooks-patterns
  - testing-patterns → testing-best-practices

Skills saved to: ~/.claude-plugins/skills/
```

### Topic-Filtered Scan

```
> /learn-skill authentication

Scanning for "authentication" related content...

Found 3 matching files:

1. oauth-flow.md (94% confidence) - 2,300 words
   Topics: OAuth, authentication, JWT

2. session-management.md (85% confidence) - 1,500 words
   Topics: Sessions, authentication, cookies

3. api-security.md (71% confidence) - 1,100 words
   Topics: API keys, authentication, rate limiting

Select files to convert (1-3 or 'all'): all

[... conversions proceed ...]
```

## Edge Cases

### No Candidates Found

```
No skill candidates found in current directory.

Tips:
- Ensure .md files have substantial content (>500 words)
- Check that files have heading structure
- Try scanning parent directory
- Use /convert-to-skill for specific files
```

### All Files Excluded

If all files are standard (README, LICENSE, etc.):
```
Found 3 markdown files, but all are standard files:
- README.md (documentation)
- CHANGELOG.md (version history)
- LICENSE.md (license)

No skill candidates found.
```

### Referenced Files Broken

If referenced file doesn't exist:
```
Warning: oauth-flow.md references missing file:
  - authentication-details.md (link broken)

Continue conversion without referenced file? (y/n)
```

## Error Handling

**No markdown files:**
```
No markdown files found in current directory.
Use /convert-to-skill <file> to convert a specific file.
```

**Invalid topic:**
```
No files match topic "xyzabc".
Try broader terms or run /learn-skill without topic to see all candidates.
```

**Conversion failures:**
```
✓ 2 of 3 conversions successful
✗ Failed to convert: complex-doc.md
  Reason: Unable to parse structure - content too fragmented

Successfully created skills:
  - file1.md → skill-name-1
  - file2.md → skill-name-2
```

## Tips

**For best results:**
- Run from directory containing markdown files
- Use specific topics to filter large directories
- Review confidence scores before selecting
- Select 'all' for batch processing
- Consider merging related files before conversion

**Iterative learning:**
1. Run /learn-skill to discover skill candidates
2. Convert high-confidence files first
3. Use created skills in practice
4. Update source markdown based on experience
5. Run /learn-skill again to merge improvements

**Topic usage:**
- Use broad topics for initial scan (e.g., "api", "testing")
- Use specific topics to refine (e.g., "oauth", "unit-testing")
- Omit topic to see all candidates

## Related Commands

- `/convert-to-skill <file>` - Convert specific file
- View created skills in `~/.claude-plugins/skills/` or `./.claude/skills/`

## Implementation Notes

- Command validates directory and performs initial scan
- Launches skill-builder agent for each selected conversion
- Agent handles all user interaction (name selection, scope, merging, cleanup)
- Command aggregates results and shows summary
- Uses Glob for file discovery
- Uses Read for content analysis
- Uses AskUserQuestion for file selection

## Success Criteria

Command succeeds when:
- ✓ Directory scanned successfully
- ✓ Candidates identified with confidence scores
- ✓ User selects files to convert
- ✓ Each conversion completes or fails gracefully
- ✓ Summary shows what was created
- ✓ User knows where to find new skills
