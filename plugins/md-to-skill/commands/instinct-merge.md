---
name: instinct-merge
description: Merge similar or duplicate instincts into a single combined instinct
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# Instinct Merge Command

Detect and merge similar or duplicate instincts into single combined instincts. Reduces redundancy and consolidates evidence.

## Execution Workflow

### Step 1: Load All Instincts

Use Glob to find all instinct files:
```
.claude/md-to-skill-instincts/*.md
```

For each file, parse YAML frontmatter to extract:
- `id`, `trigger`, `confidence`, `domain`, `observations`, `source`, `evolved`, `sessions` (if present)

**Skip instincts with `source: "inherited"`** — inherited instincts are read-only.

If fewer than 2 personal instincts found:
```
Not enough instincts to check for merges.
You have {count} personal instinct(s). Need at least 2 to detect duplicates.
```
Exit.

### Step 2: Detect Merge Candidates

Group instincts by `domain`.

Within each domain, compare every pair of instincts:

**Keyword overlap detection:**
1. Split each instinct's `trigger` into words (lowercase, strip punctuation)
2. Remove stop words: "when", "the", "a", "an", "in", "on", "for", "to", "is", "are", "and", "or", "of", "with"
3. Count shared keywords between two triggers
4. Calculate overlap: `shared_count / min(words_in_A, words_in_B)`
5. Flag pairs with > 60% overlap as merge candidates (reason: "similar triggers")

**Identical action detection:**
1. Read the `## Action` section from each instinct's body
2. If two instincts have different triggers but the action text is > 80% similar (word-level comparison), flag as merge candidate (reason: "same action, different triggers")

Collect all flagged pairs.

If no merge candidates found:
```
No merge candidates found.

All {count} instincts in {domain_count} domains are sufficiently distinct.
```
Exit.

### Step 3: Present Candidates

Show detected merge candidates:

```
## Merge Candidates

1. Similar triggers:
   - {id-A} ({confidence-A}) + {id-B} ({confidence-B})
     Trigger A: "{trigger-A}"
     Trigger B: "{trigger-B}"
     Keyword overlap: {percent}%
     Suggested merged trigger: "{combined unique keywords as natural phrase}"

2. Same action, different triggers:
   - {id-C} ({confidence-C}) + {id-D} ({confidence-D})
     Trigger C: "{trigger-C}"
     Trigger D: "{trigger-D}"
     Both recommend: "{shared action summary}"
     Suggested merge: combine triggers into single instinct
```

Use AskUserQuestion to let user select which pairs to merge:

```json
{
  "questions": [{
    "question": "Which pairs should be merged?",
    "header": "Instinct Merge",
    "multiSelect": true,
    "options": [
      {
        "label": "Pair 1: {id-A} + {id-B}",
        "description": "{overlap}% overlap — {reason}"
      },
      {
        "label": "Pair 2: {id-C} + {id-D}",
        "description": "{reason}"
      },
      {
        "label": "All pairs",
        "description": "Merge all {count} candidate pairs"
      },
      {
        "label": "Cancel",
        "description": "Don't merge anything"
      }
    ]
  }]
}
```

### Step 4: Perform Merge

For each selected pair ({instinct-A}, {instinct-B}):

**Determine the survivor:** The instinct with higher confidence is the survivor (its ID is kept).

**Merge fields:**
- `trigger`: Merge unique keywords from both triggers into a natural phrase
- `confidence`: Average of both — `(conf-A + conf-B) / 2`
- `observations`: Sum of both observation counts
- `sessions`: Union of both `sessions` arrays (if present), cap at 20 most recent
- `last_seen`: Most recent `last_seen` from the two
- `domain`: Keep the survivor's domain (should be same for both)
- `source`: Keep the survivor's source

**Merge body content:**
- `## Action`: Combine action descriptions (remove duplicated sentences)
- `## Evidence`: Append evidence lines from both instincts, prefixed with source ID

**Write the merged instinct file** using the survivor's path (`.claude/md-to-skill-instincts/{survivor-id}.md`).

### Step 5: Delete Merged-Away Instincts

For each merge, delete the non-survivor instinct file:

```bash
rm ".claude/md-to-skill-instincts/{deleted-id}.md"
```

### Step 6: Show Results

```
## Merge Complete

**Pairs merged:** {count}

1. {id-A} + {id-B} → {survivor-id}
   Confidence: {conf-A} + {conf-B} → {averaged}
   Observations: {obs-A} + {obs-B} = {total}
   Deleted: {deleted-id}

**Remaining instincts:** {total_count}

Run /instinct-status for updated report.
```

## Error Handling

**File write fails:** Report which merge failed, do NOT delete the source instinct if the merged file wasn't written successfully.

**Malformed instinct files:** Skip pairs where either file can't be parsed, note in output: "Skipped {id}: could not parse frontmatter".

**User cancels:** Exit without changes.
