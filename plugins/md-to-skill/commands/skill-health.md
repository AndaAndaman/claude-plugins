---
name: skill-health
description: Analyze skill usage data, identify underperforming skills, and suggest description improvements
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# Skill Health Check Command

Analyze installed skills usage data, identify underperforming skills, and suggest improvements to their trigger descriptions.

## Purpose

This command reads the usage tracking file (`.claude/md-to-skill-usage.json`), scans installed skills, and provides a health report with actionable suggestions for improving skill activation rates.

## Execution Workflow

### Step 1: Load Usage Tracking Data

Read the tracking file at `.claude/md-to-skill-usage.json`.

If it does not exist, create a default empty one:
```json
{
  "skills": {},
  "total_invocations": 0
}
```

### Step 2: Scan Installed Skills

Find all installed skills in both scopes:

**User scope:**
```
Use Glob: ~/.claude-plugins/skills/*/SKILL.md
```

**Project scope:**
```
Use Glob: ./.claude/skills/*/SKILL.md
```

For each skill found:
- Read the SKILL.md frontmatter (name, description, version)
- Extract the skill directory name as the skill identifier

### Step 3: Register Untracked Skills

For any skill found in Step 2 that is NOT in the tracking file:
- Add it with `trigger_count: 0`, `first_seen: <now>`, `last_triggered: null`
- Save the updated tracking file

### Step 4: Categorize Skills

Categorize each tracked skill:

**Healthy** (trigger_count > 5 AND last_triggered within 30 days):
- Skills that are working well
- Show with a check mark

**Low Usage** (trigger_count 1-5):
- Skills that trigger occasionally but may need better descriptions
- Suggest description improvements

**Never Triggered** (trigger_count = 0):
- Skills that have never been activated
- Likely have poor trigger phrases
- High priority for improvement

**Stale** (last_triggered more than 30 days ago, but trigger_count > 0):
- Skills that used to work but stopped being triggered
- May need updated descriptions or content refresh

### Step 5: Analyze Underperforming Skills

For skills categorized as "Low Usage", "Never Triggered", or "Stale":

1. Read their SKILL.md file
2. Extract the frontmatter description
3. Analyze description quality:
   - Does it have quoted trigger phrases? (e.g., "create a widget")
   - Are trigger phrases specific enough? (not too generic)
   - Does it mention key concepts/domain terms?
   - Is the description long enough to give Claude context?
4. Generate specific improvement suggestions:
   - Suggest additional trigger phrases based on skill content
   - Recommend more specific wording
   - Suggest domain-specific terms to include

### Step 6: Present Health Report

Output the report in this format:

```
## Skill Health Report

**Total Skills:** X | **Total Invocations:** Y

### Healthy (X skills)
- skill-name: Z triggers, last used [date]
- skill-name: Z triggers, last used [date]

### Low Usage (X skills) - May need better descriptions
- skill-name: Z triggers, last used [date]
  Current: "description..."
  Suggestion: Add trigger phrases like "phrase1", "phrase2"

### Never Triggered (X skills) - Likely poor trigger phrases
- skill-name: 0 triggers, registered [date]
  Current: "description..."
  Suggestion: Rewrite description with specific trigger phrases

### Stale (X skills) - Not triggered recently
- skill-name: Z triggers, last used [date] (X days ago)
  Suggestion: Review if skill is still relevant

### Recommendations
1. [Most impactful improvement suggestion]
2. [Second improvement]
3. [Third improvement]
```

### Step 7: Offer to Fix

If there are underperforming skills, ask:

Use AskUserQuestion:
```json
{
  "questions": [{
    "question": "Would you like me to improve descriptions for underperforming skills?",
    "header": "Fix skills",
    "options": [
      {
        "label": "Yes, improve all",
        "description": "Update descriptions for all underperforming skills"
      },
      {
        "label": "Let me choose",
        "description": "Select which skills to improve"
      },
      {
        "label": "No, just the report",
        "description": "Keep current descriptions"
      }
    ]
  }]
}
```

If user wants improvements:
- For each selected skill, read the full SKILL.md
- Generate improved frontmatter description with:
  - 5-7 specific trigger phrases in quotes
  - Key domain terms mentioned
  - Brief explanation of what the skill provides
- Show the proposed change to the user
- Apply with Edit tool if approved

## Tips

- Run `/skill-health` periodically to monitor skill effectiveness
- After improving descriptions, test by asking questions that match new trigger phrases
- Skills with 0 triggers likely need completely rewritten descriptions
- Focus on trigger phrases that match how users naturally ask questions

## Error Handling

**No tracking file:**
```
No usage data found. Usage tracking starts when skills are invoked.
Creating baseline tracking file...
```

**No skills installed:**
```
No skills found in:
  - ~/.claude-plugins/skills/
  - ./.claude/skills/

Create skills with /convert-to-skill or /learn-skill first.
```

## Related Commands

- `/convert-to-skill <file>` - Convert markdown to skill
- `/learn-skill [topic]` - Scan directory for skill candidates
