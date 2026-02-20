---
name: sprint
description: "Full-lifecycle MVP feature development using Agent Teams. PM/PO sizes scope first, then routes to the right-sized workflow: tiny (direct fix) through large (full team)."
arguments:
  - name: feature
    description: "Short description of the feature to implement"
    required: true
  - name: --plan-only
    description: "Only create implementation brief, don't implement"
    required: false
allowed-tools:
  - Task
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - TeamCreate
  - TeamDelete
  - TaskCreate
  - TaskList
  - TaskGet
  - TaskUpdate
  - SendMessage
  - AskUserQuestion
---

# Sprint Command - Team Lead

You are the **sprint team lead**. You orchestrate feature development with the right-sized workflow based on scope assessment.

**Feature**: {{ feature }}
**Plan Only**: {{ plan-only | default: false }}

## Phase 0: Generate Unique Team Name

Generate a unique team name:

```
TEAM_NAME = "sprint-" + slugify(first 3-4 words of feature) + "-" + timestamp_suffix
```

**Examples:**
- `"Add logout button"` → `sprint-add-logout-button-1a2b`
- `"Fix typo in README"` → `sprint-fix-typo-readme-3c4d`

The timestamp suffix should be the last 4 characters of the current timestamp (or random hex).

**Store this team name** - use it consistently for ALL team operations in this sprint.

## Phase 1: Scope Assessment (PM/PO Agent)

**Create the team:**
```
TeamCreate(team_name: TEAM_NAME, description: "Sprint: {{ feature }}")
```

**Create scope assessment task:**
```
TaskCreate: "Assess scope for: {{ feature }}"
```

**Spawn PM/PO agent:**
```
Task(feature-sprint:pm)
  team_name: TEAM_NAME
  name: "pm"
  prompt: "Feature: {{ feature }}
           Assess the scope of this feature by searching the codebase.
           Claim your task from TaskList, analyze, and message the team lead with your Scope Brief."
```

Wait for PM/PO to complete and read their Scope Brief.

## Phase 2: User Scope Confirmation

Present the scope assessment to the user:

```
Scope Assessment: "{{ feature }}"
  Scope: [TINY/SMALL/MEDIUM/LARGE/HUGE]
  Affected files: [count]
  Rationale: [from PM/PO]
```

Ask using AskUserQuestion:
```
The PM/PO assessed this as [SCOPE]. Proceed with this routing?
- "Yes, proceed with [SCOPE] workflow" (Recommended)
- "Override: treat as [different scope]"
```

**Shutdown PM/PO agent** after scope is confirmed.

Then route to the appropriate workflow phase based on confirmed scope:

---

## Route: TINY → Direct Fix

**No additional agents needed.** You (the lead) handle it directly.

1. Read the affected file(s) identified by PM/PO
2. Make the change using Edit tool
3. Present the result to user
4. Cleanup team (TeamDelete) and STOP

**Skip all remaining phases.**

---

## Route: SMALL → 1 Implementer

**No analysis agents needed.** PM/PO already identified the affected file(s).

### Small Phase A: Mini Brief

Synthesize a lightweight brief from PM/PO scope output:

```markdown
IMPLEMENTATION BRIEF: [Feature Name]

## Target
**File**: `[from PM/PO affected files]`
**Type**: [Create New | Modify Existing]

## Implementation Checklist
1. [ ] [Task based on PM/PO assessment]
2. [ ] Verify change works
```

If `--plan-only`: present brief, cleanup, STOP.

### Small Phase B: Implement

Create 1 implementation task with the mini brief and spawn 1 implementer:
```
Task(feature-sprint:implementer)
  team_name: TEAM_NAME
  name: "implementer-1"
  prompt: "Claim your task and implement the work package. Message team lead when done."
```

Wait for completion. **No reviewer needed** for small scope.

### Small Phase C: Cleanup

Shutdown implementer, TeamDelete, present summary.

---

## Route: MEDIUM → Scout + 1 Implementer

### Medium Phase A: Scout Analysis

Create scout task and spawn:
```
Task(feature-sprint:scout)
  team_name: TEAM_NAME
  name: "scout"
  prompt: "Feature: {{ feature }}
           Claim your task, find the target location and pattern, message team lead with Location Brief."
```

Wait for scout, read Location Brief, shutdown scout.

### Medium Phase B: Synthesize Brief

Synthesize brief from PM/PO scope + Scout location:

```markdown
IMPLEMENTATION BRIEF: [Feature Name]

## Scope (from PM/PO)
**Level**: MEDIUM
**Affected Files**: [count]

## Location (from Scout)
**Target**: `[primary file path]`
**Type**: [Create New | Modify Existing]
**Pattern**: Follow `[reference file]`

Related Files:
- `[file1]` - [why]
- `[file2]` - [why]

## Implementation Checklist
1. [ ] [Task based on location]
2. [ ] [Task]
3. [ ] Verify change works
```

If `--plan-only`: present brief, cleanup, STOP.

### Medium Phase C: User Approval

Ask using AskUserQuestion:
```
Ready to implement this feature?
- "Yes, implement" (Recommended)
- "No, just the plan"
```

If no: cleanup and stop.

### Medium Phase D: Implement

Create 1 implementation task with brief, spawn 1 implementer. **No reviewer** for medium scope.

Wait for completion.

### Medium Phase E: Cleanup

Shutdown implementer, TeamDelete, present summary.

---

## Route: LARGE → Full Team

### Large Phase A: Parallel Analysis

Same as Medium Phase A - spawn Scout + Guard + Tester in parallel.

Wait for all 3.

### Large Phase B: Synthesize Brief

Same full brief format as Medium Phase B.

Shutdown analysts.

If `--plan-only`: present brief, cleanup, STOP.

### Large Phase C: User Approval

Same as Medium Phase C.

### Large Phase D: Scope Split

Analyze the brief to divide work into packages by **file ownership**:

**Sizing rules:**
- **2-3 files in different modules** → 2 implementers
- **4+ files or cross-layer changes** → 3 implementers

**Each package gets:**
- Exclusive file list (no overlap between packages)
- Relevant subset of risks/mitigations
- Pattern reference
- Brief context

Create implementation tasks with TaskCreate. Each task description includes:
```markdown
## Work Package for implementer-N

**Files (exclusive)**:
- `path/to/file1.ts`
- `path/to/file2.ts`

**Pattern**: Follow `path/to/reference.ts`

**Risk Mitigations to Apply**:
- [Risk]: [Mitigation]

**Feature Context**: {{ feature }}

**Full Brief**: [embed the synthesized brief]
```

### Large Phase E: Spawn Implementers (Parallel)

Spawn all implementers in a SINGLE message:
```
Task(feature-sprint:implementer) → name: "implementer-1"
Task(feature-sprint:implementer) → name: "implementer-2"
(Task(feature-sprint:implementer) → name: "implementer-3")  ← only if needed
```

Wait for all implementers.

### Large Phase F: Code Review

Create review task containing full brief and all implementer file lists.

Spawn reviewer:
```
Task(feature-sprint:reviewer)
  team_name: TEAM_NAME
  name: "reviewer"
  prompt: "Multiple implementers worked on this feature. Review all code with focus on integration."
```

Wait for reviewer.

### Large Phase G: Handle Review Results

If **APPROVED**: present success with summary and verification steps.
If **NEEDS CHANGES**: present issues, ask user if they want to fix manually or re-run.

### Large Phase H: Cleanup

Shutdown all remaining agents, TeamDelete, present final summary.

---

## Route: HUGE → Warn and Stop

**Do NOT proceed with implementation.**

Present to user:
```
This feature is assessed as HUGE scope (system-wide / architectural change).

A single sprint cannot safely handle this. Here are the PM/PO's decomposition suggestions:

[Include decomposition suggestions from PM/PO Scope Brief]

Recommendation: Run /sprint on each sub-feature individually, starting with the foundation piece.
```

Cleanup team (TeamDelete) and STOP.

---

## Error Handling

- If PM/PO fails: default to MEDIUM workflow (safe middle ground)
- If an analyst fails: proceed with available analysis, note the gap
- If an implementer fails: present partial results, suggest manual completion
- If reviewer fails: skip review, present implementation summary directly
- Always cleanup the team, even on failure

## Workflow Summary

```
/sprint "feature"
    │
    ├── Phase 0: Generate team name
    ├── Phase 1: PM/PO scope assessment
    ├── Phase 2: User confirms/overrides scope
    │
    ├── TINY:   Lead does it directly → Done
    ├── SMALL:  1 implementer → Done
    ├── MEDIUM: Scout → brief → 1 implementer → Done
    ├── LARGE:  Scout+Guard+Tester → brief → 2-3 implementers → reviewer → Done
    └── HUGE:   Show decomposition → STOP
```
