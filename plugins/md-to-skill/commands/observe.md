---
name: observe
description: Analyze session observations and extract instinct patterns
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
  - Task(learning-observer)
argument-hint: "[--auto] [--patterns] [--since <date>] [--replay]"
arguments:
  - name: auto
    flag: true
    description: Create instincts automatically without prompting
  - name: patterns
    flag: true
    description: Dry-run mode — show detected patterns without creating instincts
  - name: since
    description: Only analyze observations after this date (ISO format)
  - name: replay
    flag: true
    description: Reprocess ALL observations ignoring last-analyzed state
---

# Observe Command

Analyze accumulated tool use observations and extract instinct patterns — lightweight learned behaviors that can evolve into full skills.

## Arguments

- `--auto` — Create instincts automatically without prompting (confidence starts at initialConfidence from config)
- `--patterns` — Dry-run mode: show detected patterns without creating instincts
- `--since <date>` — Only analyze observations after the given date (ISO format: 2026-02-01)
- `--replay` — Reprocess ALL observations ignoring last-analyzed state. Shows diff between previous and new analysis results.

## Execution Workflow

### Step 0: Load Configuration

Read the plugin's `config/defaults.json` for threshold values. Then check `.claude/md-to-skill.local.md` for user overrides.

Key config values used throughout:
- `instincts.initialConfidence` (default: 0.3) — starting confidence for new instincts
- `instincts.confidenceIncrement` (default: 0.1) — confidence boost per confirming observation
- `instincts.maxConfidence` (default: 0.95) — confidence cap
- `instincts.autoApproveThreshold` (default: 0.7) — auto-approve instincts at this level

### Step 0.5: Load Processing State

Read `.claude/md-to-skill-observe-state.json` to determine what was already processed:

```json
{
  "last_analyzed_timestamp": "2026-02-10T15:00:00",
  "last_analyzed_count": 127,
  "last_run": "2026-02-11T10:00:00"
}
```

- If the file does not exist: this is the first run, process all observations
- If the file exists: use `last_analyzed_timestamp` to filter observations in Step 1 (unless `--replay` or `--since` overrides it)

### Step 1: Load Observations

Read `.claude/md-to-skill-observations.jsonl` line by line. Each line is a JSON entry:

```json
{
  "timestamp": "2026-02-10T10:00:00",
  "tool": "Write",
  "input_summary": {"file_path": "src/utils/helper.ts", "content_length": 450},
  "output_summary": {"success": true},
  "session_id": "abc123",
  "patterns": {
    "naming": {"case": "kebab-case"},
    "workflow_hash": "def456"
  }
}
```

**Observation filtering (applied in this priority order):**

1. **If `--replay` argument provided:** Process ALL observations (bypass idempotent filter and `--since`)
2. **If `--since <date>` argument provided:** Skip entries with timestamps before the given date (overrides state-based filter)
3. **If processing state exists (Step 0.5):** Skip entries with `timestamp <= last_analyzed_timestamp` (idempotent default)
4. **If no state file exists (first run):** Process all observations

**If `--since <date>` argument provided:** Skip entries with timestamps before the given date.

**If `--replay` argument provided:**
- Before processing, snapshot the current state: count existing instincts and their confidence values
- Skip any idempotent filter / last-analyzed state — process ALL observations from scratch
- After analysis completes, show a diff between previous and new results:

```
## Replay Analysis

**Previous run:** {last_count} observations processed, {instinct_count} instincts
**Replay run:** {total_count} observations processed, {new_instinct_count} instincts

**New patterns found:** {count}
  - {pattern description}

**Changed instincts:** {count}
  - {id}: confidence {old} → {new}
```

If the file does not exist or is empty:
```
No observations collected yet.
Tool use is automatically recorded during sessions.
Check back after working on some tasks.
```
Exit.

### Step 2: Load Existing Instincts

Use Glob to find all instinct files in both directories:
```
.claude/md-to-skill-instincts/*.md
```

For each instinct file, parse the YAML frontmatter to extract:
- `id`, `trigger`, `confidence`, `domain`, `last_seen`, `observations`, `source`, `auto_approved`

**Separate by source:**
- **Personal** (`source: "session-observation"` or no source field) — will be updated
- **Inherited** (`source: "inherited"`) — read-only, never modified
- **Imported** (`source: "imported"`) — can be updated but flagged separately

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

**User corrections** (from `patterns.correction` field):
- Write followed by Edit on same file indicates preference change
- Example: "prefer-arrow-functions" if corrections consistently use arrow syntax

**Workflow sequences** (from `patterns.workflow_hash` field):
- Repeated hash patterns indicate consistent multi-step workflows
- Example: Read→Edit→Bash(test) → "test-after-edit-workflow"

**Naming conventions** (from `patterns.naming` field):
- Consistent case styles across file operations
- Example: All files use kebab-case → "prefer-kebab-case-naming"

**For complex patterns that need deeper analysis**, delegate to the learning-observer agent:

Task(learning-observer)

### Step 4: Match Against Existing Instincts

For each detected pattern, check if it matches an existing personal instinct by comparing:
- Domain tag similarity
- Trigger phrase overlap
- Action description similarity

**If existing personal instinct matches:**
- Increase `confidence` by `instincts.confidenceIncrement` (cap at `instincts.maxConfidence`)
- Update `last_seen` to now
- Increment `observations` count
- Append the current `session_id` to the `sessions` array in frontmatter (if not already present, cap at 20 entries — keep most recent)
- Append new evidence line to `## Evidence` section
- Write updated instinct file

**If inherited instinct matches:**
- Do NOT modify the inherited instinct
- Note the match in summary: "Confirmed inherited pattern: {id}"

**If no match found (new pattern):**
- Add to new instincts list for Step 5

### Step 4.5: Conflict Detection

Before creating new instincts, check each new pattern for conflicts with existing instincts:

**Conflict criteria:**
- Same domain AND opposite/contradictory action keywords:
  - "prefer X" vs "avoid X"
  - "always" vs "never"
  - "use X" vs "don't use X" / "avoid X"
- Overlapping trigger phrases with different actions (same trigger, different recommended behavior)

**Detection process:**
1. For each new pattern, compare against all existing instincts (personal + inherited)
2. Check domain match first (same `domain` tag)
3. If same domain, compare action text for contradictions:
   - Extract action verbs and objects from both
   - Look for negation pairs ("prefer" vs "avoid", "always" vs "never", "use" vs "don't use")
   - Look for same trigger with semantically opposite actions

**When conflict detected:**

Present to user via AskUserQuestion:

```json
{
  "questions": [{
    "question": "New pattern conflicts with existing instinct '{existing_id}'. How should we proceed?",
    "header": "Instinct Conflict Detected",
    "options": [
      {
        "label": "Override existing",
        "description": "Update '{existing_id}' with new action, reset confidence to {initialConfidence}"
      },
      {
        "label": "Keep both",
        "description": "Create new instinct alongside the existing one"
      },
      {
        "label": "Skip new",
        "description": "Don't create the new instinct, keep existing '{existing_id}'"
      }
    ]
  }]
}
```

**Based on user choice:**
- **Override existing:** Update the existing instinct's Action section with the new action, reset `confidence` to `initialConfidence`, update `last_seen` to now, and add evidence note: "Overridden by conflicting pattern ({date})"
- **Keep both:** Continue to Step 5 to create the new instinct normally
- **Skip new:** Remove the pattern from the new instincts list (do not create)

**In `--auto` mode:** Skip conflict detection (always create new instincts, let user resolve later with `/instinct-prune`).

**In `--patterns` mode:** Report conflicts but take no action:
```
[DRY RUN] Conflict: new pattern "{trigger}" conflicts with existing "{existing_id}"
  New action: {new_action}
  Existing action: {existing_action}
```

### Step 5: Create New Instincts

For each new pattern detected:

**If `--patterns` argument was passed (dry-run):**
- Show pattern but do NOT create instinct:
```
[DRY RUN] Would create: {instinct-id} ({domain}) at confidence {initialConfidence}
  Trigger: "{trigger}"
  Evidence: {description}
```
- Skip to Step 7

**If `--auto` argument was passed:**
- Create instinct automatically at `instincts.initialConfidence`
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
        "description": "Save as new instinct at confidence {initialConfidence}"
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
confidence: {initialConfidence from config}
domain: "{domain-tag}"
source: "session-observation"
created: "{ISO timestamp}"
last_seen: "{ISO timestamp}"
observations: {count}
sessions: ["{current_session_id}"]
auto_approved: false
---

# {Title Case Name}

## Action
{What to do when trigger matches}

## Evidence
- {Description of observation} ({date})
```

### Step 5.5: Auto-Approve Check

After creating/updating all instincts, check if any instinct has reached `instincts.autoApproveThreshold`:

For each instinct with `confidence >= autoApproveThreshold` AND `auto_approved` is not `true`:
- Set `auto_approved: true` in frontmatter
- Set `auto_approved_date: "{ISO timestamp}"`
- Write updated instinct file

Report auto-approved instincts:
```
Auto-approved instincts (confidence >= {threshold}):
  - {id} ({confidence}) [{domain}] — now active in sessions
```

Auto-approved instincts represent strong, validated patterns that should be treated as established behaviors.

### Step 6: Show Summary

```
## Observation Analysis Complete

**Observations processed:** {count}
**Date range:** {earliest} to {latest}

**Personal instincts updated:** {count}
  - prefer-functional-style: 0.5 → 0.6 (2 new observations)
  - always-run-tests: 0.7 → 0.8 (4 new observations)

**Inherited instincts confirmed:** {count}
  - team-code-style: confirmed by 3 observations (read-only)

**New instincts created:** {count}
  - arrow-functions-preferred (code-style) at {initialConfidence}
  - test-before-commit (workflow) at {initialConfidence}

**Auto-approved:** {count}
  - always-run-tests (0.8) — now active

**Config:** auto-approve >= {threshold} | max confidence {maxConfidence} | increment {increment}

Run /instinct-status for full instinct report.
Run /evolve to check if instincts are ready to become skills.
```

### Step 6.5: Save Processing State

After showing the summary (and not in `--patterns` dry-run mode), write updated state to `.claude/md-to-skill-observe-state.json`:

```json
{
  "last_analyzed_timestamp": "{timestamp of the latest observation processed}",
  "last_analyzed_count": {total observations processed in this run},
  "last_run": "{current ISO timestamp}"
}
```

This ensures the stop hook only counts observations **after** this timestamp, so the counter resets to 0 after `/observe` — even if the user skips all instincts. The observations file is preserved for `--replay`.

**Skip this step if:**
- `--patterns` mode (dry run should not update state)
- No observations were processed (empty set after filtering)

### Step 7: Show Dry-Run Summary (--patterns mode only)

```
## Pattern Analysis (Dry Run)

**Observations analyzed:** {count}
**Patterns detected:** {count}

{For each pattern:}
- [{domain}] {trigger} — {evidence_count} observations
  Would create instinct: {id} at confidence {initialConfidence}

No instincts were created. Remove --patterns flag to create them.
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
- `naming` — File naming, variable naming conventions

## Error Handling

**Corrupted JSONL entries:** Skip individual bad lines, continue processing.

**Permission errors on instinct files:** Report and continue with other instincts.

**Empty observations:** Exit gracefully with message.

**Config load failure:** Fall back to hardcoded defaults and warn user.
