---
name: instinct-status
description: Show learned instincts with confidence scores and usage data
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Instinct Status Command

Display all learned instincts with confidence scores, domain tags, observation counts, and staleness indicators.

## Execution Workflow

### Step 1: Load Instincts

Use Glob to find all instinct files:
```
.claude/md-to-skill-instincts/*.md
```

If no instinct files found:
```
No instincts found.

Instincts are learned from session observations.
Run /observe to analyze tool use patterns and create instincts.
```
Exit.

### Step 2: Parse Instinct Frontmatter

For each instinct file, parse YAML frontmatter to extract:
- `id` — Instinct identifier
- `trigger` — When condition
- `confidence` — Current confidence score (0.0-0.9)
- `domain` — Domain tag
- `source` — How it was created
- `created` — Creation timestamp
- `last_seen` — Last observation timestamp
- `observations` — Total observation count
- `evolved` — Whether it has been evolved into a skill (optional)

### Step 3: Apply Confidence Decay

For each instinct, calculate staleness:
- Parse `last_seen` timestamp
- Calculate days since last seen
- If > 14 days: subtract 0.05 per week elapsed (minimum 0.1)
- Store decayed confidence for display (do NOT write back to file — decay is display-only)

Example: confidence 0.6, last seen 28 days ago → 2 weeks of decay → 0.6 - 0.10 = 0.5

### Step 4: Categorize Instincts

Group instincts into categories based on decayed confidence:

**Strong** (confidence >= 0.7):
- Core behaviors, well-validated
- Display with high prominence

**Growing** (confidence 0.4 - 0.69):
- Being validated through repeated observation
- Display normally

**Tentative** (confidence 0.3 - 0.39):
- New observations, not yet validated
- Display with note about needing more observations

**Stale** (last_seen > 30 days ago, regardless of confidence):
- May need pruning
- Display with pruning suggestion

**Evolved** (evolved: true in frontmatter):
- Already converted to full skills
- Display separately with link to skill

### Step 5: Display Report

Output the report:

```
## Instinct Report

**Total:** {count} instincts across {domain_count} domains
**Observations file:** {size} ({entry_count} entries)

### Strong ({count})
- {id} ({confidence}) [{domain}] — {observations} observations, last seen {relative_time}
  Trigger: "{trigger}"

### Growing ({count})
- {id} ({confidence}) [{domain}] — {observations} observations, last seen {relative_time}
  Trigger: "{trigger}"

### Tentative ({count})
- {id} ({confidence}) [{domain}] — {observations} observations, last seen {relative_time}
  Trigger: "{trigger}"
  Needs more observations to strengthen.

### Stale ({count})
- {id} ({confidence} decayed from {original}) [{domain}] — {observations} observations, last seen {days}d ago
  Consider removing with /instinct-prune

### Evolved ({count})
- {id} → evolved into skill "{skill-name}"

### Domain Summary
| Domain | Count | Avg Confidence |
|--------|-------|---------------|
| code-style | 4 | 0.62 |
| testing | 3 | 0.70 |
| workflow | 2 | 0.45 |

### Recommendations
- {If clusters ready:} Run /evolve — {domain} has {count} instincts ready to become a skill
- {If stale:} Run /instinct-prune — {count} stale instincts could be removed
- {If few instincts:} Keep working! More observations will strengthen existing instincts
```

### Step 6: Show Observations Summary

Read `.claude/md-to-skill-observations.jsonl` and report:
- File size
- Total entry count
- Date range of observations
- Suggest /observe if many unprocessed entries exist

## Error Handling

**Malformed frontmatter:** Skip that instinct file, note it in report as "1 instinct file could not be parsed".

**Missing observations file:** Show "No observations file found" in summary section.
