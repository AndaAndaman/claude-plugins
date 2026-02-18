---
name: sprint-plan
description: "Create implementation brief only (no implementation). Includes scope assessment from PM/PO agent."
arguments:
  - name: feature
    description: "Short description of the feature to analyze"
    required: true
allowed-tools:
  - Task
  - Read
  - Glob
  - Grep
  - TeamCreate
  - TeamDelete
  - TaskCreate
  - TaskList
  - TaskGet
  - TaskUpdate
  - SendMessage
  - AskUserQuestion
---

# Sprint Plan Command

Create an implementation brief without executing implementation. Includes PM/PO scope assessment.

This is a shorthand for `/sprint "feature" --plan-only`.

**Feature**: {{ feature }}
**Plan Only**: true (always)

## Step 0: Generate Team Name

Generate a unique team name:
```
TEAM_NAME = "plan-" + slugify(first 3-4 words of feature) + "-" + timestamp_suffix
```

## Step 1: Scope Assessment

**Create the team:**
```
TeamCreate(team_name: TEAM_NAME, description: "Plan: {{ feature }}")
```

**Create and spawn PM/PO:**
```
Task(feature-sprint:pm)
  team_name: TEAM_NAME
  name: "pm"
  prompt: "Feature: {{ feature }}
           Assess the scope. Claim your task, analyze codebase, message team lead with Scope Brief."
```

Wait for PM/PO to complete. Read scope level from their brief.

**Shutdown PM/PO.**

## Step 2: Route Analysis by Scope

### If TINY scope:
Present scope brief directly - no further analysis needed:
```markdown
SCOPE BRIEF: [Feature Name]

Scope: TINY
This is a trivial change. No implementation brief needed.

Affected file: [path]
Change: [what to change]

Just run: /sprint "{{ feature }}" to execute directly.
```
Cleanup team and STOP.

### If SMALL scope:
Spawn Scout only:
```
Task(feature-sprint:scout)
  prompt: "Feature: {{ feature }}. Find target location and pattern. Return Location Brief."
```

### If MEDIUM, LARGE, or HUGE scope:
**CRITICAL**: Spawn all 3 agents in a SINGLE message with multiple Task tool calls:

```
Task(feature-sprint:scout)
  team_name: TEAM_NAME
  name: "scout"
  prompt: "Scout the codebase for: {{ feature }}
           Find: target file, related files (max 3), pattern to follow.
           Return a Location Brief."

Task(feature-sprint:guard)
  team_name: TEAM_NAME
  name: "guard"
  prompt: "Identify risks for: {{ feature }}
           Find: max 3 critical risks with mitigations.
           Return a Risk Brief."

Task(feature-sprint:tester)
  team_name: TEAM_NAME
  name: "tester"
  prompt: "Define test strategy for: {{ feature }}
           Find: manual verification steps (max 5), one automated test suggestion.
           Return a Test Brief."
```

Wait for all to complete. Shutdown analysts.

## Step 3: Synthesize Implementation Brief

Combine scope assessment + analysis into unified format:

```markdown
IMPLEMENTATION BRIEF: [Feature Name]

## Scope Assessment (from PM/PO)
- **Scope**: [tiny | small | medium | large | huge]
- **Rationale**: [why]
- **Affected Files**: [count]
- **Recommended Workflow**: [description based on scope]

## Location (from Scout)
**Target**: `[primary file path]`
**Type**: [Create New | Modify Existing]
**Pattern**: Follow `[reference file]`

Related Files:
- `[file1]` - [why]
- `[file2]` - [why]

## Risks (from Guard) [if medium+ scope]
1. **[Risk]** - [Mitigation]
2. **[Risk]** - [Mitigation]

## Verification (from Tester) [if medium+ scope]
Manual:
- [ ] [Step 1]
- [ ] [Step 2]
- [ ] [Step 3]

Automated: `[test file suggestion]`

## Implementation Checklist
1. [ ] [First task]
2. [ ] [Second task]
3. [ ] [Third task]
4. [ ] Run verification
```

For **HUGE** scope, replace implementation checklist with decomposition suggestions.

## Step 4: Present and Stop

Present the brief. Cleanup team (TeamDelete). **Do NOT ask about implementation** - this is plan-only mode.

## Use Cases

- **Scope estimation**: Understand feature size before committing
- **Review before commit**: Get the plan, review with team, then implement
- **Learning**: Understand how to approach a feature
- **Documentation**: Generate implementation guide for handoff

## Example

```bash
/sprint-plan "Add user avatar upload to profile settings"
```

Returns implementation brief with:
- Scope assessment (likely: large)
- Target files and patterns
- Risks and mitigations
- Verification steps
- Implementation checklist (or decomposition for huge)

No code changes are made.
