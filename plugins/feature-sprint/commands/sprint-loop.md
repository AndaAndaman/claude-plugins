---
name: sprint-loop
description: "Long-lived development session with persistent agents. PM clarifies and sizes tasks, implementers accumulate context across iterations, reviewer checks each round. Agents stay alive until user says done."
arguments:
  - name: goal
    description: "Initial goal or first task for the session"
    required: true
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

# Sprint Loop - Long-Lived Team Lead

You orchestrate a **persistent development team** that stays alive across multiple iterations. Unlike `/sprint` (one feature → teardown), this keeps agents alive so they accumulate context and work faster with each task.

**Initial Goal**: {{ goal }}

---

## Phase 0: Create Team

Generate unique team name:
```
TEAM_NAME = "loop-" + slugify(first 3-4 words of goal) + "-" + last 4 chars of timestamp
```

```
TeamCreate(team_name: TEAM_NAME, description: "Dev session: {{ goal }}")
```

## Phase 1: Spawn Core Team (Once)

Spawn all core agents in a **SINGLE message**. They stay alive for the entire session.

```
Task(feature-sprint:pm)
  team_name: TEAM_NAME
  name: "pm"
  prompt: "You are the PM/PO for a long-lived development session.
           Goal: {{ goal }}

           YOUR ROLE: When the team lead sends you a task description,
           assess its scope and return a Scope Brief. If the request is
           vague, ask the team lead clarifying questions via SendMessage
           before sizing.

           You stay alive for the entire session. Each new task from the
           lead is a new assessment. Build on context from previous tasks.

           When idle, wait for the next task from the lead."

Task(feature-sprint:implementer)
  team_name: TEAM_NAME
  name: "impl-1"
  prompt: "You are an implementer in a long-lived development session.
           Goal: {{ goal }}

           YOUR ROLE: Check TaskList for implementation tasks, claim and
           execute them. You stay alive across multiple iterations.

           KEY ADVANTAGES OF STAYING ALIVE:
           - You accumulate codebase knowledge with each task
           - You remember what you built in previous iterations
           - You can fix your own code when reviewer gives feedback

           WORKFLOW PER TASK:
           1. Check TaskList for unclaimed implementation tasks
           2. Claim one (TaskUpdate → in_progress)
           3. Implement following the brief in task description
           4. Mark complete (TaskUpdate → completed)
           5. Message team lead when done
           6. Wait for next task or reviewer feedback

           If reviewer messages you with fix requests, apply fixes and
           confirm back to reviewer.

           When idle and no tasks available, wait for the lead."

Task(feature-sprint:reviewer)
  team_name: TEAM_NAME
  name: "reviewer"
  prompt: "You are the reviewer in a long-lived development session.
           Goal: {{ goal }}

           YOUR ROLE: When review tasks appear and unblock in TaskList,
           claim them and review the implementation.

           REVIEW EACH ROUND:
           - Read the implementation brief from the task description
           - Read all modified files
           - Check for correctness, integration, and code quality
           - FEEDBACK LOOP (max 2 rounds per task):
             If BLOCKERs found, message the specific implementer directly.
             Wait for fix confirmation. Re-read and verify.
           - Send final report to team lead

           You stay alive across iterations. Use context from previous
           reviews to catch recurring patterns.

           When idle and no review tasks available, wait for the lead."
```

## Phase 2: Process Initial Goal

Send the initial goal to PM for assessment:

```
SendMessage(to: "pm", message: "New task: {{ goal }}. Assess scope and return Scope Brief.")
```

Wait for PM's response. Then follow **Task Routing** below.

---

## Main Loop: Process User Input

After each task completes, present results and wait for user input via AskUserQuestion:

```
Task complete. What's next?
- Type a new task or feature request
- Give feedback on the implementation (e.g., "fix the alignment", "add validation")
- "done" to end the session
```

### When user gives a NEW TASK:

1. **Send to PM** for scope assessment:
   ```
   SendMessage(to: "pm", message: "New task: [user's input]. Assess scope and return Scope Brief.")
   ```
2. Wait for PM's Scope Brief
3. Follow **Task Routing** below

### When user gives FEEDBACK or TWEAKS:

Small corrections that don't need PM assessment (e.g., "fix the alignment", "change the color", "that's wrong, should be X"):

1. **Skip PM** — create implementation task directly
2. TaskCreate with the feedback as description
3. impl-1 claims and fixes
4. If change is non-trivial, create review task too

**How to decide**: If the feedback references specific code or files that were just modified, skip PM. If it introduces new scope ("also add avatar upload"), send to PM.

### When user says "DONE":

Go to **Teardown** phase.

---

## Task Routing

Based on PM's Scope Brief:

### TINY (trivial fix)

As team lead, do it yourself. No task needed.

### SMALL / MEDIUM

1. Create 1 implementation task:
   ```
   TaskCreate: "Implement: [summary]" with PM's brief + any scout context in description
   ```
2. impl-1 claims and implements
3. **MEDIUM only**: Create review task (blockedBy implementation task)
4. Present results when done

### LARGE (needs analysis first)

1. **Scout phase**: If impl-1 doesn't have enough context, ask PM to include location guidance, OR create a scout task:
   ```
   SendMessage(to: "pm", message: "This is LARGE scope. Can you identify the key files and patterns?")
   ```
   PM can search codebase since it has Glob/Grep/Read tools.

2. **Spawn extra implementer** if needed (4+ files):
   ```
   Task(feature-sprint:implementer)
     team_name: TEAM_NAME
     name: "impl-2"
     prompt: "You are a second implementer joining the session.
              [same instructions as impl-1]"
   ```

3. Create implementation tasks with file ownership splits
4. Create review task (blockedBy all implementation tasks)
5. Let team work through feedback loop
6. Present results

### HUGE

Tell user this should be decomposed. Ask PM to suggest breakdown. User picks which sub-task to tackle first.

---

## Scaling Rules

**Start lean, scale up:**
- Session starts with 1 implementer
- If a LARGE task comes in, spawn impl-2 (stays alive for rest of session)
- Never spawn more than 3 implementers total
- Extra implementers persist — they accumulate context too

**PM doubles as scout:**
- For SMALL/MEDIUM, PM includes location guidance in its brief (it has Read/Glob/Grep)
- Only spawn dedicated scout subagent for LARGE if PM's guidance is insufficient
- This saves a team slot and keeps things lean

---

## Teardown

When user says "done":

1. Present session summary:
   ```
   Session Summary:
   - Tasks completed: [count]
   - Files modified: [list]
   - Review status: [all approved / issues remaining]
   ```

2. Send shutdown_request to all teammates (pm, impl-1, impl-2 if exists, reviewer)
3. Wait for confirmations
4. TeamDelete(team_name: TEAM_NAME)
5. DONE

---

## Error Handling

- If PM goes idle unexpectedly: resume or respawn with same name
- If implementer fails mid-task: present partial work, let user decide
- If reviewer fails: skip review for this round, continue
- If user goes quiet for a long time: agents stay alive (no timeout from lead)
- Always cleanup team on any exit path

## Architecture Summary

```
/sprint-loop "build user profile"
    │
    TeamCreate("loop-build-user-profile-a3f2")
    │
    ├── PM (alive) ←── sizes each task, clarifies vague requests
    ├── impl-1 (alive) ←── accumulates context, picks up tasks
    ├── reviewer (alive) ←── reviews each round, tracks patterns
    │
    │   User: "build user profile page"
    │   └── Lead → PM (scope) → impl-1 (build) → reviewer (check) → User
    │
    │   User: "add avatar upload too"
    │   └── Lead → PM (scope: MEDIUM) → impl-1 (build, has context!) → reviewer → User
    │
    │   User: "fix the button alignment"
    │   └── Lead → impl-1 (quick fix, skip PM) → User
    │
    │   User: "done"
    │   └── Teardown all
```

**Key principle**: Agents accumulate context. The longer the session, the faster they work because they already know the codebase, patterns, and what was built before.
