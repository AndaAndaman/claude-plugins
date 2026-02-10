---
name: observe
description: Analyze session observations and extract instinct patterns
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
argument-hint: [--auto]
---

# Observe Command

Analyze accumulated tool use observations and extract instinct patterns — lightweight learned behaviors that can evolve into full skills.

## Execution Workflow

### Step 1: Load Observations

Read `.claude/md-to-skill-observations.jsonl` line by line. Each line is a JSON entry:

```json
{
  "timestamp": "2026-02-10T10:00:00",
  "tool": "Write",
  "input_summary": {"file_path": "src/utils/helper.ts", "content_length": 450},
  "output_summary": {"success": true},
  "session_id": "abc123"
}
```

If the file does not exist or is empty:
```
No observations collected yet.
Tool use is automatically recorded during sessions.
Check back after working on some tasks.
```
Exit.

### Step 2: Load Existing Instincts

Use Glob to find all existing instincts:
```
.claude/md-to-skill-instincts/*.md
```

For each instinct file, parse the YAML frontmatter to extract:
- `id`, `trigger`, `confidence`, `domain`, `last_seen`, `observations`

### Step 3: Analyze Patterns

Look for these pattern types in the observations:

**Tool preferences:**
- Repeated use of specific tools for similar tasks
- Example: Always using Grep instead of Bash grep → "prefer-grep-over-bash-grep"

**File patterns:**
- Repeated edits to similar file types or paths
- Example: Always creating .test.ts alongside .ts files → "always-create-tests"

**Edit patterns:**
- Repeated similar edits (replace_all usage, consistent file types)
- Example: Frequently editing .scss files after .ts files → "style-after-logic"

**Command patterns:**
- Repeated bash commands or command prefixes
- Example: Always running `npm test` after edits → "test-after-edit"

**Error → fix sequences:**
- A failed tool use followed by a successful one
- Example: Bash error then Edit fix → "handle-X-error-by-Y"

### Step 4: Match Against Existing Instincts

For each detected pattern, check if it matches an existing instinct by comparing:
- Domain tag similarity
- Trigger phrase overlap
- Action description similarity

**If existing instinct matches:**
- Increase `confidence` by 0.1 (cap at 0.9)
- Update `last_seen` to now
- Increment `observations` count
- Append new evidence line to `## Evidence` section
- Write updated instinct file

**If no match found (new pattern):**
- Add to new instincts list for Step 5

### Step 5: Create New Instincts

For each new pattern detected:

**If `--auto` argument was passed:**
- Create instinct automatically at confidence 0.3
- Log: "Auto-created: {instinct-id} ({domain})"

**If interactive mode (default):**
- Present each new pattern to user:

```
New pattern detected:

  Trigger: "when writing TypeScript files"
  Action: Always includes strict type annotations
  Domain: code-style
  Evidence: 5 observations of typed function signatures

Create as instinct?
```

Use AskUserQuestion:
```json
{
  "questions": [{
    "question": "Create instinct for this pattern?",
    "header": "New instinct",
    "options": [
      {
        "label": "Yes, create",
        "description": "Save as new instinct at confidence 0.3"
      },
      {
        "label": "Skip",
        "description": "Don't create this instinct"
      }
    ]
  }]
}
```

**Instinct file format** (written to `.claude/md-to-skill-instincts/{id}.md`):

```markdown
---
id: {kebab-case-id}
trigger: "{when condition}"
confidence: 0.3
domain: "{domain-tag}"
source: "session-observation"
created: "{ISO timestamp}"
last_seen: "{ISO timestamp}"
observations: {count}
---

# {Title Case Name}

## Action
{What to do when trigger matches}

## Evidence
- {Description of observation} ({date})
```

### Step 6: Show Summary

```
## Observation Analysis Complete

**Observations processed:** 127
**Existing instincts updated:** 3
  - prefer-functional-style: 0.5 → 0.6 (2 new observations)
  - always-run-tests: 0.7 → 0.8 (4 new observations)
  - use-strict-types: 0.6 → 0.7 (1 new observation)

**New instincts created:** 2
  - arrow-functions-preferred (code-style) at 0.3
  - test-before-commit (workflow) at 0.3

Run /instinct-status for full instinct report.
Run /evolve to check if instincts are ready to become skills.
```

## Domains

Use these standard domain tags:
- `code-style` — Formatting, syntax preferences, naming conventions
- `testing` — Test creation, test-first approaches, test patterns
- `workflow` — Process patterns, command sequences, file organization
- `tool-preference` — Preferred tools for specific tasks
- `error-handling` — Error recovery patterns, retry strategies
- `architecture` — Structural preferences, module organization
- `documentation` — Comment style, doc generation patterns

## Error Handling

**Corrupted JSONL entries:** Skip individual bad lines, continue processing.

**Permission errors on instinct files:** Report and continue with other instincts.

**Empty observations:** Exit gracefully with message.
