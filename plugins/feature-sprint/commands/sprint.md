---
name: sprint
description: "Full-lifecycle MVP feature development. PM/PO sizes scope, then routes: tiny/small/medium use fast subagents, large uses Agent Teams with real collaboration, huge warns and decomposes."
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

You orchestrate feature development with the right-sized approach based on scope.

**Feature**: {{ feature }}
**Plan Only**: {{ plan-only | default: false }}

## Phase 1: Scope Assessment

Spawn PM/PO as a **subagent** (not a team member) to assess scope quickly:

```
Task(feature-sprint:pm)
  prompt: "Feature: {{ feature }}
           Assess the scope by searching the codebase. Return your Scope Brief."
```

Read the scope level from the PM/PO's response.

Present scope to user and ask for confirmation:
```
Scope Assessment: "{{ feature }}"
  Scope: [TINY/SMALL/MEDIUM/LARGE/HUGE]
  Affected files: [list]
  Rationale: [from PM/PO]
```

Ask using AskUserQuestion:
```
PM/PO assessed this as [SCOPE]. Proceed?
- "Yes, proceed with [SCOPE] workflow" (Recommended)
- "Override: treat as [different scope]"
```

Route to the appropriate workflow:

---

## Route: TINY - Lead Does It

**No agents needed.** Handle it directly.

1. Read the affected file(s) from PM/PO assessment
2. Make the change using Edit tool
3. Present the result
4. DONE

---

## Route: SMALL - Subagent Implementer

**Use subagents** - no team needed, no inter-agent communication required.

### 1. Build Mini Brief

From PM/PO scope output:
```markdown
IMPLEMENTATION BRIEF: [Feature Name]

## Target
**File**: `[from PM/PO affected files]`
**Type**: [Create New | Modify Existing]

## Implementation Checklist
1. [ ] [Task based on PM/PO assessment]
2. [ ] Verify change works
```

If `--plan-only`: present brief, STOP.

### 2. Implement via Subagent

Spawn 1 implementer as subagent:
```
Task(feature-sprint:implementer)
  prompt: "[Embed the mini brief here]
           Implement the changes. Return summary of what you did."
```

Present results. DONE.

---

## Route: MEDIUM - Subagent Scout + Implementer

**Use subagents** - sequential but fast, no team overhead.

### 1. Scout via Subagent

```
Task(feature-sprint:scout)
  prompt: "Feature: {{ feature }}
           Find the target location and pattern. Return a Location Brief."
```

### 2. Build Brief

Combine PM/PO scope + Scout location:
```markdown
IMPLEMENTATION BRIEF: [Feature Name]

## Scope: MEDIUM
**Affected Files**: [count]

## Location (from Scout)
**Target**: `[primary file path]`
**Pattern**: Follow `[reference file]`

Related Files:
- `[file1]` - [why]

## Implementation Checklist
1. [ ] [Task based on location]
2. [ ] Verify change works
```

If `--plan-only`: present brief, STOP.

### 3. User Approval

Ask: Ready to implement? Yes (Recommended) / No, just the plan

### 4. Implement via Subagent

Spawn 1 implementer as subagent with the brief. Present results. DONE.

---

## Route: LARGE - Agent Teams with Real Collaboration

**This is the only scope that uses Agent Teams.** Multiple agents need to discuss, challenge each other, and coordinate interface contracts.

### Phase A: Create Team + Analysis Tasks

Generate unique team name:
```
TEAM_NAME = "sprint-" + slugify(first 3-4 words) + "-" + last 4 chars of timestamp
```

```
TeamCreate(team_name: TEAM_NAME, description: "Sprint: {{ feature }}")
```

Create 3 analysis tasks using TaskCreate:
1. "Scout: find location for {{ feature }}"
2. "Guard: identify risks for {{ feature }}"
3. "Tester: define tests for {{ feature }}"

No dependencies between them - all can start immediately.

### Phase B: Spawn Analysts (All at Once)

**CRITICAL**: Spawn all 3 in a SINGLE message. They are **teammates**, not subagents - they share a task list and can message each other.

```
Task(feature-sprint:scout)
  team_name: TEAM_NAME
  name: "scout"
  prompt: "Feature: {{ feature }}
           You're on a sprint team with Guard and Tester. Check TaskList, claim your task,
           find the target location. Share findings with Guard for location-specific risks.
           Challenge Tester if test placement seems wrong."

Task(feature-sprint:guard)
  team_name: TEAM_NAME
  name: "guard"
  prompt: "Feature: {{ feature }}
           You're on a sprint team with Scout and Tester. Check TaskList, claim your task,
           identify risks. Check Scout's location brief for location-specific risks.
           Challenge Tester if a risk's mitigation isn't testable."

Task(feature-sprint:tester)
  team_name: TEAM_NAME
  name: "tester"
  prompt: "Feature: {{ feature }}
           You're on a sprint team with Scout and Guard. Check TaskList, claim your task,
           define test strategy. Verify Guard's risk mitigations are testable.
           Use Scout's findings for test file placement."
```

**Let them work.** They will:
- Self-claim tasks from the shared task list
- Analyze the codebase independently
- Message each other to challenge and cross-reference
- Mark their tasks as completed when done
- Message you (team lead) with their briefs

Wait for all 3 tasks to show `completed` in TaskList.

### Phase C: Synthesize Brief + Shutdown Analysts

Read all analyst messages and task outputs. Synthesize:

```markdown
IMPLEMENTATION BRIEF: [Feature Name]

## Scope: LARGE
**Affected Files**: [from PM/PO]

## Location (from Scout)
**Target**: `[primary file path]`
**Pattern**: Follow `[reference file]`
Related Files: [list]

## Risks (from Guard)
1. **[Risk]** [HIGH/MEDIUM] - Mitigation: [how]
2. **[Risk]** - Mitigation: [how]

## Verification (from Tester)
Manual:
- [ ] [Step 1]
- [ ] [Step 2]
Automated: `[test file suggestion]`

## Implementation Checklist
1. [ ] [Task]
2. [ ] [Task]
3. [ ] Run verification
```

Send shutdown_request to scout, guard, tester (save tokens).

If `--plan-only`: present brief, TeamDelete, STOP.

### Phase D: User Approval

Present the full brief. Ask: Ready to implement? Yes / No

If no: TeamDelete, STOP.

### Phase E: Create Implementation + Review Tasks

**Scope split** - divide work by file ownership:
- 2-3 files in different modules → 2 implementers
- 4+ files or cross-layer → 3 implementers

Create tasks with **dependencies**:

```
TaskCreate: "Implement package 1: [files]" (with full work package in description)
TaskCreate: "Implement package 2: [files]" (with full work package in description)
TaskCreate: "Review all implementation" (blockedBy: [package-1-id, package-2-id])
```

The review task is **blocked** until all implementation tasks complete. This lets the reviewer auto-start when implementers finish.

### Phase F: Spawn Implementers + Reviewer (All at Once)

Spawn everyone in a SINGLE message. The reviewer will wait for its dependencies to unblock.

```
Task(feature-sprint:implementer)
  team_name: TEAM_NAME
  name: "implementer-1"
  prompt: "You're on a sprint team. Check TaskList, claim your implementation task.
           Your files are EXCLUSIVE - don't touch other implementers' files.
           If you need something from implementer-2's files, message them for the interface contract.
           Message team lead when done.
           IMPORTANT: If the reviewer messages you with fix requests, apply the fixes
           and message the reviewer back when done."

Task(feature-sprint:implementer)
  team_name: TEAM_NAME
  name: "implementer-2"
  prompt: "You're on a sprint team. Check TaskList, claim your implementation task.
           Your files are EXCLUSIVE. Coordinate with implementer-1 on interfaces.
           Message team lead when done.
           IMPORTANT: If the reviewer messages you with fix requests, apply the fixes
           and message the reviewer back when done."

Task(feature-sprint:reviewer)
  team_name: TEAM_NAME
  name: "reviewer"
  prompt: "You're on a sprint team. Check TaskList - your review task is blocked until
           implementers finish. Wait for it to unblock, then claim it.
           Review ALL code for end-to-end integration.

           FEEDBACK LOOP (max 2 rounds):
           If you find BLOCKER issues, message the SPECIFIC implementer who owns that file
           with the exact fix needed. Wait for them to confirm the fix. Then re-read the
           file to verify. Only message team lead with your final report after issues
           are resolved or after 2 rounds of feedback.
           For SUGGESTION-level issues, include them in your report but don't block on them."
```

**Let them work.** The feedback loop happens naturally:

```
Implementers work in parallel
    → complete their tasks
        → review task unblocks
            → reviewer reads all code
                → if BLOCKERs: messages implementer directly
                    → implementer fixes
                        → reviewer re-checks (max 2 rounds)
                → final report to team lead
```

Implementers will:
- Self-claim their tasks
- Work in parallel on exclusive files
- Message each other for interface contracts
- Complete and notify
- **Stay alive** to handle reviewer fix requests

Reviewer will:
- Wait for review task to unblock
- Read all files, check integration
- **Message implementers directly** about BLOCKERs (not the lead)
- Wait for fixes, re-verify
- Send final report to team lead after resolution

### Phase G: Handle Results

When reviewer sends final report:
- **APPROVED**: Present success with verification steps
- **APPROVED WITH SUGGESTIONS**: Present success + list of optional improvements
- **UNRESOLVED after 2 rounds**: Present remaining issues to user for manual fix

### Phase H: Cleanup

Send shutdown_request to all remaining teammates. TeamDelete. Present final summary.

---

## Route: HUGE - Warn and Decompose

**Do NOT create a team.** Use PM/PO's decomposition suggestions.

```
This feature is assessed as HUGE scope (system-wide / architectural change).

A single sprint cannot safely handle this. Decomposition suggestions:

[From PM/PO Scope Brief]

Recommendation: Run /sprint on each sub-feature individually.
```

STOP.

---

## Error Handling

- If PM/PO fails: default to MEDIUM workflow
- If an analyst fails: proceed with available analysis, note the gap
- If an implementer fails: present partial results, suggest manual completion
- If reviewer fails: skip review, present implementation summary
- Always cleanup team on failure (TeamDelete if team was created)

## Architecture Summary

```
/sprint "feature"
    |
    |-- PM/PO subagent → scope assessment
    |
    |-- TINY:   Lead fixes directly (no agents)
    |-- SMALL:  Subagent implementer (no team)
    |-- MEDIUM: Subagent scout → subagent implementer (no team)
    |-- LARGE:  Agent Teams (real collaboration):
    |             Create team → analysts collaborate → brief
    |             → implementers + reviewer self-coordinate → done
    |-- HUGE:   Decompose → STOP (no agents)
```

**Key principle**: Use subagents for focused work. Use Agent Teams only when agents need to discuss, challenge, and coordinate with each other.
