---
name: observe-health
description: Check the health of the observation collection system
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Observe Health Command

Check the health status of the observation collection system, hooks, instincts, and configuration.

## Execution Workflow

### Step 1: Check Observations File

Check if `.claude/md-to-skill-observations.jsonl` exists.

- If missing: flag as BROKEN issue ("Observations file not found — hooks may not be recording")
- If exists: report file size (KB) and count entries (number of lines)

### Step 2: Check Last Observation Timestamp

Read the last line of `.claude/md-to-skill-observations.jsonl` and parse its `timestamp` field.

- If last observation is older than 24 hours: flag as DEGRADED issue ("Last observation is stale — recorded {time_ago}")
- Report: "last at {timestamp}"

### Step 3: Validate Recent Entries

Read the last 50 entries from `.claude/md-to-skill-observations.jsonl`. For each entry, validate:

- Has `timestamp` field (string, ISO format)
- Has `tool` field (string, one of Write/Edit/Bash)
- Has `input_summary` field (object)
- Has `output_summary` field (object)
- Has `patterns` field (object)

Report count of valid vs invalid entries. If more than 10% invalid: flag as DEGRADED issue ("Schema validation: {invalid_count}/50 recent entries have issues").

### Step 4: Check Hooks Configuration

Read the plugin's `hooks/hooks.json` and verify these hooks are configured:

1. **observer** — PostToolUse matcher `Write|Edit|Bash` with `observe_posttooluse.py`
2. **usage** — PostToolUse matcher `Skill` with `skill-usage_posttooluse.py`
3. **watcher** — Stop hook with `md-watch_stop.py`
4. **instinct-suggest** — PreToolUse matcher `Write|Edit|Bash` with `instinct-suggest_pretooluse.py`

Report each as OK or MISSING. If any are missing: flag as DEGRADED issue.

### Step 5: Check Session Cache

Check `.claude/md-to-skill-session-cache.json`:
- If exists: report write count and bash failure count from cache
- If missing: report "No session cache (normal for first run)"

### Step 6: Load Configuration Summary

Load config via the standard approach (read `config/defaults.json`, check for `.claude/md-to-skill.local.md` overrides).

Report key settings:
- observer enabled/disabled
- maxObservationsMB
- enabled capture patterns

### Step 7: Check Archive Files

Use Glob to find `.claude/md-to-skill-observations.archive-*.jsonl` files.
Report count of archive files found.

### Step 8: Check Instincts

Use Glob to find `.claude/md-to-skill-instincts/*.md` files.

For each instinct file, parse frontmatter and count:
- Total instincts
- Auto-approved instincts (`auto_approved: true`)
- Stale instincts (no `last_seen` within 30 days)

If instinct directory is missing or empty: note but don't flag as issue (normal for fresh setups).

### Step 9: Check Processing State

Check `.claude/md-to-skill-observe-state.json`:
- If exists: report last analyzed timestamp and count
- If missing: report "No processing state (all observations will be processed on next /observe)"

### Step 10: Determine Overall Verdict

**HEALTHY:** All hooks configured, observations file exists and not stale, schema validation passes, no issues found.

**DEGRADED:** Some hooks missing, stale observations, schema validation issues, or minor configuration problems.

**BROKEN:** Observations file missing, no hooks configured, or critical configuration errors.

### Step 11: Output Report

```
## Observation Health Report

**Status:** {HEALTHY | DEGRADED | BROKEN}

**Observations:** {count} entries, {size} KB, last at {timestamp}
**Archives:** {count} archive files
**Session Cache:** {writes} writes, {failures} bash failures cached
**Hooks:** {count}/{total} configured (observer: {OK|MISSING}, usage: {OK|MISSING}, watcher: {OK|MISSING}, instinct-suggest: {OK|MISSING})
**Instincts:** {count} instincts, {auto_approved} auto-approved
**Processing State:** last analyzed {timestamp}, {count} entries processed
**Config:** observer={enabled}, maxMB={max}, patterns={enabled_patterns}

{If issues found:}
### Issues
- {issue description and fix suggestion}
```

## Error Handling

- If any step fails to read a file, report the specific error and continue with remaining checks
- Never crash — always produce a report even if partial
- Missing files are not necessarily errors (fresh installations won't have observations or instincts)
