---
name: instinct-import
description: Import instincts from an export file, marking them as imported
allowed-tools:
  - Read
  - Write
  - Glob
  - AskUserQuestion
argument-hint: "<file-path>"
arguments:
  - name: file-path
    description: Path to the instincts export JSON file (defaults to .claude/instincts-export.json)
---

# Instinct Import Command

Import instincts from a portable JSON export file into the current project.

## Execution Workflow

### Step 1: Load Export File

Determine the file path:
- If argument provided: use that path
- If no argument: default to `.claude/instincts-export.json`

Read the file. If it does not exist:
```
Export file not found: {path}

To create an export file, run /instinct-export in the source project.
```
Exit.

### Step 2: Validate Schema

Parse the JSON and validate:
- Must have `version` field (string)
- Must have `instincts` array
- Each instinct must have at minimum: `id`, `trigger`, `confidence`, `domain`

If validation fails:
```
Invalid export file format. Expected fields: version, instincts[].id, instincts[].trigger, instincts[].confidence, instincts[].domain

File version: {version or "missing"}
Instinct count: {count or "invalid"}
```
Exit.

### Step 3: Check for Conflicts

Use Glob to find existing instinct files:
```
.claude/md-to-skill-instincts/*.md
```

For each instinct in the import file:
1. Check if an instinct with the same `id` already exists (exact filename match: `{id}.md`)
2. If exists, read its frontmatter and check for trigger overlap:
   - Compare trigger strings — if >70% word overlap, consider it a conflict
   - Mark as "conflict" with details

Categorize each import instinct as:
- **New** — No existing instinct with same id
- **Conflict** — Existing instinct with same id or high trigger overlap

### Step 4: Present Import Plan

```
## Import Plan

Source: {source_project} ({exported_at})
File: {file_path}

### New Instincts ({count})
- {id} ({confidence}) [{domain}] — "{trigger}"

### Conflicts ({count})
- {id} ({confidence}) [{domain}] — "{trigger}"
  Existing: "{existing_trigger}" (confidence: {existing_confidence})
```

If there are conflicts, use AskUserQuestion for each conflict:
```json
{
  "questions": [{
    "question": "How to handle conflict for '{id}'?",
    "header": "Import Conflict",
    "options": [
      {
        "label": "Skip",
        "description": "Keep existing instinct unchanged"
      },
      {
        "label": "Merge",
        "description": "Keep higher confidence, combine observation counts"
      },
      {
        "label": "Override",
        "description": "Replace existing with imported version"
      }
    ]
  }]
}
```

If no conflicts, ask a single confirmation:
```json
{
  "questions": [{
    "question": "Import {count} instincts from {source_project}?",
    "header": "Import",
    "options": [
      {
        "label": "Import all",
        "description": "Create {count} new instinct files"
      },
      {
        "label": "Cancel",
        "description": "Do not import"
      }
    ]
  }]
}
```

### Step 5: Write Instinct Files

For each instinct to import (new or resolved conflict), create the instinct markdown file at `.claude/md-to-skill-instincts/{id}.md`:

```markdown
---
id: {id}
trigger: "{trigger}"
confidence: {confidence}
domain: {domain}
observations: {evidence_count}
source: "imported"
imported_from: "{source_project}"
imported_at: "{ISO timestamp}"
created: "{ISO timestamp}"
last_seen: "{ISO timestamp}"
auto_approved: {true if confidence >= 0.7}
---

# {id}

## Action
{action}

## Evidence
- Imported from project "{source_project}" on {date} ({evidence_count} observations across {sessions} sessions)
```

For **merge** resolution:
- Use the higher confidence value
- Sum observation counts
- Keep the existing `created` date
- Update `last_seen` to now
- Set `source: "merged"`

For **override** resolution:
- Replace entirely with imported values
- Set `source: "imported"`

### Step 6: Show Results

```
## Import Complete

**Imported:** {imported_count} instincts from "{source_project}"
**Skipped:** {skipped_count} (conflicts kept as-is)
**Merged:** {merged_count} (combined with existing)

New instincts:
- {id} ({confidence}) [{domain}]

Run /instinct-status to see the full instinct report.
```

## Error Handling

**File read error:** Report the specific error (permission, format, encoding).

**Write failure for individual instinct:** Report which instinct failed, continue with others.

**Malformed instinct in export:** Skip it, note in results: "Skipped {count} malformed entries".
