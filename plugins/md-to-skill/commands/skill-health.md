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

### Step 8: Cross-Reference Instincts

Check for instinct data to enrich the report:

**Scan instincts:**
```
Use Glob: .claude/md-to-skill-instincts/*.md
```

If instinct files exist:
- Count total instincts and group by domain
- Identify clusters with 3+ instincts and average confidence >= 0.5
- Check for instincts with `evolved: true` that map to tracked skills

**Add to report:**

```
### Instinct Pipeline

**Total instincts:** {count} across {domain_count} domains
**Observations collected:** {obs_count} entries

| Domain | Instincts | Avg Confidence | Ready to Evolve? |
|--------|-----------|---------------|-----------------|
| code-style | 4 | 0.65 | Yes |
| testing | 2 | 0.45 | No (need 3+) |
| workflow | 3 | 0.40 | No (avg < 0.5) |

{If any clusters ready:}
Run /evolve to convert {count} ready cluster(s) into full skills.

{If instincts exist but none ready:}
Keep working! Run /observe after sessions to strengthen instincts.

{If no instincts:}
No instincts yet. Tool use is automatically observed.
Run /observe after a few sessions to extract patterns.
```

**Skills from instincts:**
For any tracked skill that was created via /evolve (check if any instinct has `evolved_to` matching the skill name), note it:
```
- {skill-name}: Evolved from {count} instincts ({date})
```

### Step 9: Feedback Loop Report

Check for skill-to-instinct feedback reinforcement data:

For each tracked skill, check if any instinct has `evolved_to` matching the skill name AND `usage_reinforced: true`:

**Add to report:**

```
### Feedback Loop
```

For each tracked skill:
- Use Grep to search instinct files for `evolved_to: "{skill-name}"` in `.claude/md-to-skill-instincts/`
- If matching instincts found, check for `usage_reinforcement_count` in their frontmatter
- Report:
```
- {skill-name}: reinforced {count} source instincts ({instinct-ids}) — total {sum_reinforcement_count} reinforcements
```
- If no matching instincts:
```
- {skill-name}: no source instincts found (manually created or converted)
```

If no tracked skills have source instincts at all:
```
### Feedback Loop
No skills with source instincts found. Skills created via /evolve will automatically reinforce their source instincts when used.
```

## Related Commands

### Learning Commands (Primary)
- `/observe` - Analyze observations and extract instincts
- `/instinct-status` - View instinct report
- `/evolve` - Cluster instincts into skills
- `/instinct-prune` - Remove stale instincts
- `/skill-health` - This command

### Conversion Commands (Secondary)
- `/convert-to-skill <file>` - Convert markdown to skill
- `/learn-skill [topic]` - Scan directory for skill candidates
