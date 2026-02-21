---
name: skill-shopping
description: Analyze current task context and recommend relevant installed skills from active plugins
allowed-tools:
  - Read
  - Glob
  - Grep
arguments:
  - name: task
    description: Optional task description or keyword to match skills against
    required: false
argument-hint: [task-description-or-keyword]
---

# Skill Shopping Command

Scan all installed skills across active plugins, match them to your current task or conversation context, and display a compact ranked table of relevant skills to invoke.

## Purpose

This command helps you discover which installed skills are relevant to what you are currently working on:
- Analyzes the optional task description or recent conversation context
- Scans all skills visible to Claude (user scope and project scope)
- Ranks skills by relevance to the described task
- Outputs a compact table: skill name, plugin source, one-line description, and trigger command

## Execution Workflow

### Step 1: Determine Search Context

**If `[task]` argument is provided:**
- Use the argument text as the primary search query
- Extract keywords from the argument (nouns, verbs, domain terms)

**If no argument is provided:**
- Analyze the recent conversation context
- Identify the current task or goal from the last few user messages
- Extract 3-5 key concepts or domain terms to match against

### Step 2: Scan Installed Skills

Find all SKILL.md files in both scopes:

**User scope:**
```
Use Glob: ~/.claude-plugins/skills/*/SKILL.md
```

**Project scope:**
```
Use Glob: ./.claude/skills/*/SKILL.md
```

For each SKILL.md found:
- Read the frontmatter (name, description)
- Extract the skill directory name (used as identifier)
- Infer plugin source from the directory path (e.g., `md-to-skill`, `quick-wins`, `ask-before-code`, or `custom` for user-created skills)

### Step 3: Rank by Relevance

For each skill, compute a relevance score against the search context:

**Scoring criteria:**
- **Name match** (+3 points): Skill name contains a search keyword (exact or partial)
- **Description match** (+2 points per keyword): Skill description mentions a search keyword
- **Domain match** (+1 point): Skill content domain aligns with inferred task domain

**Read SKILL.md content only if the name/description gives ambiguous signal** and you need to confirm relevance. Keep reads minimal.

Sort skills descending by relevance score. Skills with score 0 are excluded from results.

### Step 4: Infer Plugin Source

Determine the plugin source for each skill based on path or frontmatter:

- Path contains `md-to-skill` or skill relates to learning/instincts → `md-to-skill`
- Path contains `quick-wins` or skill relates to code quality/refactoring → `quick-wins`
- Path contains `ask-before-code` or skill relates to requirements/clarity → `ask-before-code`
- Path contains `local-memory` or skill relates to context/memory → `local-memory`
- Otherwise → `custom`

### Step 5: Display Results

Output a compact ranked table:

```
Relevant skills for: "[task or inferred context]"

| # | Skill | Plugin | Description | Invoke |
|---|-------|--------|-------------|--------|
| 1 | skill-name | plugin-name | One-line description | /skill-name |
| 2 | skill-name | plugin-name | One-line description | /skill-name |
| 3 | skill-name | plugin-name | One-line description | /skill-name |
```

**Table rules:**
- Show maximum 8 results (top by relevance score)
- Truncate description at 60 characters if needed (add `...`)
- If no skills match, show the "No matches" message below
- Omit score column from output (internal only)

### Step 6: Handle No Matches

If no skills score above 0:

```
No installed skills match "[task or inferred context]".

Tips:
- Try broader keywords (e.g., "testing" instead of "jest unit test")
- Install more skills with /convert-to-skill or /learn-skill
- Browse all installed skills with /skill-health
```

If no skills are installed at all:

```
No skills installed yet.

Get started:
- /convert-to-skill <file>  Convert a markdown file into a skill
- /learn-skill              Scan directory for skill candidates
```

## Examples

### With task argument

```
> /skill-shopping refactoring TypeScript

Relevant skills for: "refactoring TypeScript"

| # | Skill                     | Plugin      | Description                                      | Invoke                    |
|---|---------------------------|-------------|--------------------------------------------------|---------------------------|
| 1 | refactoring-patterns      | quick-wins  | TypeScript/Angular/.NET before-after refactoring | /refactoring-patterns     |
| 2 | code-quality-checks       | quick-wins  | Defines what constitutes a quick win improvemen... | /code-quality-checks      |
| 3 | skill-structure-patterns  | md-to-skill | Best practices for Claude skills with templates  | /skill-structure-patterns |
```

### Without argument (context inference)

```
> /skill-shopping

Analyzing recent conversation context...
Inferred task: "markdown conversion and skill creation"

Relevant skills for: "markdown conversion and skill creation"

| # | Skill                     | Plugin      | Description                                      | Invoke                    |
|---|---------------------------|-------------|--------------------------------------------------|---------------------------|
| 1 | skill-structure-patterns  | md-to-skill | Best practices for Claude skills with templates  | /skill-structure-patterns |
| 2 | markdown-parsing          | md-to-skill | Techniques for parsing markdown structure        | /markdown-parsing         |
| 3 | continuous-learning       | md-to-skill | Observation to instinct to evolution pipeline    | /continuous-learning      |
```

### No matches

```
> /skill-shopping kubernetes deployment

No installed skills match "kubernetes deployment".

Tips:
- Try broader keywords (e.g., "deployment" or "infrastructure")
- Install more skills with /convert-to-skill or /learn-skill
- Browse all installed skills with /skill-health
```

## Implementation Notes

- Command is read-only: uses only Read, Glob, Grep — no writes, no agents
- Skill content is only read when name and description are insufficient to determine relevance
- Plugin source is inferred from path; fallback is `custom`
- Trigger command uses the skill directory name prefixed with `/`
- Relevance scoring is lightweight (keyword matching), not semantic

## Related Commands

- `/skill-health` - View all installed skills with usage data and health status
- `/convert-to-skill <file>` - Convert a markdown file into a new skill
- `/learn-skill [topic]` - Scan directory for skill candidates to convert
