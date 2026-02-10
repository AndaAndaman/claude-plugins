---
name: instinct-prune
description: Remove stale or low-confidence instincts
allowed-tools:
  - Read
  - Glob
  - Bash
  - AskUserQuestion
---

# Instinct Prune Command

Identify and remove stale or low-confidence instincts that are no longer useful.

## Execution Workflow

### Step 1: Load All Instincts

Use Glob to find all instinct files:
```
.claude/md-to-skill-instincts/*.md
```

If no instinct files found:
```
No instincts to prune. Run /observe to create instincts first.
```
Exit.

### Step 2: Identify Prune Candidates

For each instinct, parse frontmatter and check:

**Auto-prune candidates** (recommended for removal):
- Confidence < 0.2 (very weak, likely noise)
- Last seen > 60 days ago (abandoned patterns)

**Review candidates** (user should decide):
- Confidence < 0.3 AND last seen > 30 days ago
- Observations count = 1 AND created > 14 days ago (single observation that was never reinforced)

Skip instincts with `evolved: true` — they are preserved as historical record.

### Step 3: Present Candidates

If no candidates found:
```
All instincts are healthy! No pruning needed.

Summary:
- {total} instincts checked
- Lowest confidence: {id} ({confidence})
- Oldest: {id} (last seen {days}d ago)
```
Exit.

Show candidates:

```
## Prune Candidates

### Recommended for Removal ({count})
These instincts have very low confidence or haven't been seen in 60+ days:

- {id} ({confidence}) [{domain}] — {observations} obs, last seen {days}d ago
  Trigger: "{trigger}"

### Review ({count})
These instincts are weak and may not be useful:

- {id} ({confidence}) [{domain}] — {observations} obs, last seen {days}d ago
  Trigger: "{trigger}"
```

### Step 4: Get User Decision

Use AskUserQuestion:
```json
{
  "questions": [{
    "question": "Which instincts should be removed?",
    "header": "Prune",
    "options": [
      {
        "label": "Remove recommended only",
        "description": "Delete {count} very weak/stale instincts"
      },
      {
        "label": "Remove all candidates",
        "description": "Delete {total_count} weak and stale instincts"
      },
      {
        "label": "Cancel",
        "description": "Keep all instincts"
      }
    ]
  }]
}
```

### Step 5: Delete Selected Instincts

For each instinct to remove, delete the file:
```bash
rm .claude/md-to-skill-instincts/{id}.md
```

### Step 6: Show Results

```
## Prune Complete

**Removed:** {count} instincts
- {id} ({confidence}) [{domain}]
- {id} ({confidence}) [{domain}]

**Remaining:** {remaining} instincts

Run /instinct-status for updated report.
```

## Error Handling

**File deletion fails:** Report which files couldn't be deleted, continue with others.

**Malformed instinct files:** Include in prune candidates with note "could not parse frontmatter".
