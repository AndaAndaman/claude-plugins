---
name: instinct-export
description: Export instincts to a portable JSON file for sharing across projects
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
argument-hint: "[--domain <domain>] [--min-confidence <threshold>]"
arguments:
  - name: domain
    description: Only export instincts matching this domain
  - name: min-confidence
    description: Only export instincts with confidence >= this threshold
---

# Instinct Export Command

Export learned instincts to a portable JSON file that can be imported into other projects.

## Execution Workflow

### Step 0: Parse Arguments

Extract optional filters from arguments:
- `--domain <domain>` — Only export instincts matching this domain
- `--min-confidence <threshold>` — Only export instincts with confidence >= threshold (default: 0.0, export all)

### Step 1: Load Instincts

Use Glob to find all instinct files:
```
.claude/md-to-skill-instincts/*.md
```

If no instinct files found:
```
No instincts to export. Run /observe to create instincts first.
```
Exit.

For each file, read and parse:
- **From YAML frontmatter:** `id`, `trigger`, `confidence`, `domain`, `observations`, `sessions` (array length, default 1 if missing), `source`
- **From body `## Action` section:** Extract the action text (everything between `## Action` and the next `##` heading or end of file)

### Step 2: Apply Filters

If `--domain` provided: filter to instincts matching that domain.
If `--min-confidence` provided: filter to instincts with confidence >= threshold.

Skip instincts with `source: "inherited"` (they belong to the originating project).

If no instincts remain after filtering:
```
No instincts match the specified filters.
```
Exit.

### Step 3: Confirm Selection

Show the user what will be exported:

```
## Instincts to Export

Found {count} instincts matching filters:

- {id} ({confidence}) [{domain}] — "{trigger}"
- {id} ({confidence}) [{domain}] — "{trigger}"
...
```

Use AskUserQuestion:
```json
{
  "questions": [{
    "question": "Export these instincts?",
    "header": "Export",
    "options": [
      {
        "label": "Export all listed",
        "description": "Export {count} instincts to .claude/instincts-export.json"
      },
      {
        "label": "Cancel",
        "description": "Do not export"
      }
    ]
  }]
}
```

If cancelled, exit.

### Step 4: Build Export JSON

Create the export structure:

```json
{
  "version": "0.6.0",
  "exported_at": "{ISO timestamp}",
  "source_project": "{basename of cwd}",
  "instincts": [
    {
      "id": "prefer-arrow-functions",
      "trigger": "when writing functions",
      "confidence": 0.8,
      "domain": "code-style",
      "action": "Use arrow function syntax",
      "evidence_count": 12,
      "sessions": 5
    }
  ]
}
```

### Step 5: Write Export File

Write to `.claude/instincts-export.json`.

Show summary:
```
## Export Complete

Exported {count} instincts to .claude/instincts-export.json

Domains exported:
- {domain}: {count} instincts
- {domain}: {count} instincts

To import in another project:
  /instinct-import .claude/instincts-export.json

Or copy the file to the target project's .claude/ directory first.
```

## Error Handling

**Malformed frontmatter:** Skip that instinct, note: "{count} instinct files could not be parsed".

**Write failure:** Report the error and suggest checking directory permissions.
