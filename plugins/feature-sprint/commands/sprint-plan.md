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
  - AskUserQuestion
---

# Sprint Plan Command

Create an implementation brief without executing implementation. Uses **subagents only** (no Agent Teams) since plan-only mode doesn't need inter-agent collaboration.

This is a shorthand for `/sprint "feature" --plan-only`.

**Feature**: {{ feature }}
**Plan Only**: true (always)

## Step 1: Scope Assessment

Spawn PM/PO as subagent:
```
Task(feature-sprint:pm)
  prompt: "Feature: {{ feature }}
           Assess the scope by searching the codebase. Return your Scope Brief."
```

Read scope level from response.

## Step 2: Route Analysis by Scope

### If TINY scope:
Present scope brief directly:
```markdown
SCOPE BRIEF: [Feature Name]

Scope: TINY - trivial change, no implementation brief needed.
Affected file: [path]
Change: [what to change]

Just run: /sprint "{{ feature }}" to execute directly.
```
STOP.

### If SMALL scope:
No further analysis needed. Use PM/PO's affected files directly for the brief.

### If MEDIUM scope:
Spawn Scout as subagent:
```
Task(feature-sprint:scout)
  prompt: "Feature: {{ feature }}. Find target location and pattern. Return Location Brief."
```

### If LARGE or HUGE scope:
Spawn all 3 analysts as **parallel subagents** in a SINGLE message:

```
Task(feature-sprint:scout)
  prompt: "Scout the codebase for: {{ feature }}
           Find: target file, related files (max 3), pattern to follow. Return Location Brief."

Task(feature-sprint:guard)
  prompt: "Identify risks for: {{ feature }}
           Find: max 3 critical risks with mitigations. Return Risk Brief."

Task(feature-sprint:tester)
  prompt: "Define test strategy for: {{ feature }}
           Find: manual verification steps (max 5), one automated test. Return Test Brief."
```

Wait for all to complete.

## Step 3: Synthesize Implementation Brief

Combine scope assessment + analysis into unified format:

```markdown
IMPLEMENTATION BRIEF: [Feature Name]

## Scope Assessment (from PM/PO)
- **Scope**: [tiny | small | medium | large | huge]
- **Rationale**: [why]
- **Affected Files**: [count]
- **Recommended Workflow**: [description based on scope]

## Location (from Scout) [if medium+ scope]
**Target**: `[primary file path]`
**Type**: [Create New | Modify Existing]
**Pattern**: Follow `[reference file]`

Related Files:
- `[file1]` - [why]

## Risks (from Guard) [if large+ scope]
1. **[Risk]** - [Mitigation]
2. **[Risk]** - [Mitigation]

## Verification (from Tester) [if large+ scope]
Manual:
- [ ] [Step 1]
- [ ] [Step 2]

Automated: `[test file suggestion]`

## Implementation Checklist
1. [ ] [First task]
2. [ ] [Second task]
3. [ ] Run verification
```

For **HUGE** scope, replace implementation checklist with decomposition suggestions.

## Step 4: Present and Stop

Present the brief. **Do NOT ask about implementation** - this is plan-only mode.

## Use Cases

- **Scope estimation**: Understand feature size before committing
- **Review before commit**: Get the plan, review with team, then implement
- **Learning**: Understand how to approach a feature
- **Documentation**: Generate implementation guide for handoff

## Example

```bash
/sprint-plan "Add user avatar upload to profile settings"
```

Returns implementation brief with scope, location, risks, verification, and checklist.
No code changes are made.
