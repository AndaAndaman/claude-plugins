---
name: instinct-reject
description: Reject an instinct so it is never suggested again
allowed-tools:
  - Read
  - Write
  - Glob
  - AskUserQuestion
argument-hint: "<instinct-id>"
---

# Instinct Reject Command

Permanently reject an instinct so it will never be suggested again. The instinct file is preserved with `rejected: true` for audit purposes, and its ID is added to a rejection registry to prevent `/observe` from recreating the same pattern.

## Execution Workflow

### Step 1: Validate Instinct ID

The user provides an instinct ID as argument. Look for the instinct file:
```
.claude/md-to-skill-instincts/{instinct-id}.md
```

If the file does not exist:
```
Instinct '{instinct-id}' not found. Run /instinct-status to see available instincts.
```
Exit.

### Step 2: Load and Display Instinct Details

Read the instinct file and parse its frontmatter. Display:

```
## Instinct: {id}

- **Trigger:** {trigger}
- **Domain:** {domain}
- **Confidence:** {confidence}
- **Observations:** {observation_count}
- **Auto-approved:** {auto_approved}
- **Created:** {created_date}
- **Last seen:** {last_seen}

### Action
{action section content}
```

If the instinct already has `rejected: true`:
```
Instinct '{id}' is already rejected (on {rejected_date}).
```
Exit.

### Step 3: Confirm Rejection

Use AskUserQuestion to confirm:
```json
{
  "questions": [{
    "question": "Reject this instinct? It will never be suggested again.",
    "header": "Reject Instinct",
    "options": [
      {
        "label": "Reject",
        "description": "Mark as rejected and stop all suggestions"
      },
      {
        "label": "Cancel",
        "description": "Keep the instinct active"
      }
    ]
  }]
}
```

If user selects "Cancel":
```
Rejection cancelled. Instinct '{id}' remains active.
```
Exit.

### Step 4: Update Instinct File

Read the instinct file and update its frontmatter:
- Set `rejected: true`
- Set `rejected_date: "{ISO timestamp}"` (e.g., `2026-02-13T10:30:00Z`)
- Set `confidence: 0.0`

Write the updated file back.

### Step 5: Update Rejection Registry

Read or create `.claude/md-to-skill-rejected.json`. The file is a JSON object with a `rejected` array:

```json
{
  "rejected": [
    {
      "id": "instinct-id",
      "trigger": "original trigger text",
      "domain": "domain-name",
      "rejected_date": "2026-02-13T10:30:00Z"
    }
  ]
}
```

Append the new rejection entry. If the file does not exist, create it with the entry.

The rejection registry is checked by `/observe` to prevent recreating rejected patterns. Entries expire after 90 days (handled by `/observe`, not this command).

### Step 6: Show Confirmation

```
Instinct '{id}' rejected.

- Marked as rejected in instinct file
- Added to rejection registry (.claude/md-to-skill-rejected.json)
- Will no longer be suggested during tool use
- /observe will not recreate this pattern for 90 days

To undo, manually edit .claude/md-to-skill-instincts/{id}.md and remove the rejected fields.
```

## Error Handling

**File write fails:** Report the error and suggest manual editing.

**Registry write fails:** Still mark the instinct file as rejected (partial success is better than none). Warn the user that the registry was not updated.

**Malformed frontmatter:** Attempt to add rejected fields anyway by appending before the closing `---`.
