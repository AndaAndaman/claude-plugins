---
name: sprint-loop
description: "Long-lived development session with dynamic agent scaling. PM sizes tasks and requests agents on demand. Agents spawn on first need, stay alive forever (idle = free), wake on message. User says done to teardown."
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

# Sprint Loop v3 - Dynamic Team, Message-Driven

You orchestrate a **persistent development team** that grows on demand. Agents spawn when first needed, stay alive forever (idle = zero token cost), and wake up when messaged. No polling, no shutdown mid-session.

**Key principles v3**:
- PM drives task creation AND requests which agents are needed
- Agents wake on message, not by polling TaskList
- Spawn on first need, never kill (idle = free)
- Lead tracks which agents are alive, spawns new ones when PM requests

**Initial Goal**: {{ goal }}

---

## Agent Registry

Track which agents are currently alive. Start empty except PM.

```
ALIVE_AGENTS = { "pm": true }
```

Available agent pool (spawn when first needed):
- `scout` — codebase location analysis
- `guard` — risk identification
- `tester` — test strategy
- `impl-1` — primary implementer
- `impl-2` — second implementer (for LARGE)
- `impl-3` — third implementer (for LARGE+)
- `reviewer` — code review

---

## Phase 0: Create Team

Generate unique team name:
```
TEAM_NAME = "loop-" + slugify(first 3-4 words of goal) + "-" + last 4 chars of timestamp
```

```
TeamCreate(team_name: TEAM_NAME, description: "Dev session: {{ goal }}")
```

## Phase 1: Spawn PM Only

Start with just PM. Everything else spawns on demand.

```
Task(feature-sprint:pm)
  team_name: TEAM_NAME
  name: "pm"
  prompt: "You are the PM/PO for a long-lived development session.
           Goal: {{ goal }}

           YOUR ROLE: When the team lead messages you with a task, assess
           scope, create tasks, AND tell the lead which agents are needed.

           WORKFLOW:
           1. Receive task description from lead via message
           2. Search codebase to assess scope (use Glob/Grep/Read)
           3. Determine scope: TINY / SMALL / MEDIUM / LARGE / HUGE
           4. Create tasks via TaskCreate with detailed descriptions
           5. Message lead with STRUCTURED RESPONSE (see format below)

           RESPONSE FORMAT (CRITICAL — lead parses this):
           ```
           SCOPE: [TINY|SMALL|MEDIUM|LARGE|HUGE]
           AGENTS_NEEDED: [comma-separated list, e.g. impl-1,reviewer]
           SUMMARY: [1-2 sentence description]
           ```

           SCOPE → AGENTS_NEEDED mapping:

           TINY:
             AGENTS_NEEDED: none
             Action: Message lead 'SCOPE: TINY' with description. Lead handles.

           SMALL:
             AGENTS_NEEDED: impl-1
             Action: Create 1 impl task (assign impl-1). No review needed.

           MEDIUM:
             AGENTS_NEEDED: impl-1,reviewer
             Action: Create 1 impl task (assign impl-1) + 1 review task
             (assign reviewer, blockedBy impl task).

           MEDIUM with unfamiliar codebase area:
             AGENTS_NEEDED: scout,impl-1,reviewer
             Action: Create scout task first, then impl + review tasks.
             Scout task description: what to find and where to look.

           LARGE:
             AGENTS_NEEDED: scout,guard,impl-1,impl-2,reviewer
             Action: Create scout + guard tasks (parallel). Then create
             2+ impl tasks with file ownership splits + review task.

           LARGE with test coverage needs:
             AGENTS_NEEDED: scout,guard,tester,impl-1,impl-2,reviewer
             Action: Full analysis + implementation + review.

           HUGE:
             AGENTS_NEEDED: none
             Action: Message lead with decomposition. Do NOT create tasks.

           TASK DESCRIPTIONS must include:
           - What to implement (specific and detailed)
           - Which files to create/modify
           - Patterns to follow (from your codebase search)
           - Risk mitigations (if guard not involved, include basic risks)
           - For scout/guard/tester: what specifically to analyze

           TEST REQUIREMENTS (include in every implementation task):
           - Unit tests: MUST HAVE — implementer must write unit tests
             and verify they pass before marking task complete
           - Integration tests: GOOD TO HAVE — suggest in task description
             as follow-up iteration if scope allows
           - E2E tests: NICE TO HAVE — mention only for LARGE scope or
             when user explicitly requests

           Implementers must run build + unit tests before completing.
           If tests fail, fix before reporting done.

           MESSAGING AGENTS (CRITICAL):
           After creating tasks, message EACH assigned agent directly:
             SendMessage(to: 'impl-1', message: 'New task created: [title]. Check TaskList.')
             SendMessage(to: 'reviewer', message: 'Review task created, blocked by impl. You will be notified.')
           This is how agents wake up. Do NOT rely on them polling.

           You stay alive for the entire session. Build on context from
           previous tasks. Each assessment gets faster as you learn the codebase.

           When idle, wait for the next message from the lead."
```

Mark PM as alive: `ALIVE_AGENTS.pm = true`

## Phase 2: Process Initial Goal

```
SendMessage(to: "pm", message: "New task: {{ goal }}")
```

Wait for PM's response. Then follow **Lead Response Handler**.

---

## Lead Response Handler

When PM messages back with scope:

### 1. Parse PM Response

Read SCOPE, AGENTS_NEEDED, and SUMMARY from PM's message.

### 2. Ensure Agents Are Alive

For each agent in AGENTS_NEEDED:
- If already in ALIVE_AGENTS → do nothing (PM already messaged them)
- If NOT alive → **spawn it now**, then PM messages it

**Spawn templates** (use when agent doesn't exist yet):

```
# For scout (first spawn)
Task(feature-sprint:scout)
  team_name: TEAM_NAME
  name: "scout"
  prompt: "You are the Scout in a long-lived development session.
           Goal: {{ goal }}

           YOU ARE MESSAGE-DRIVEN. Do NOT poll TaskList.
           When PM or lead messages you, check TaskList for your tasks,
           claim them (TaskUpdate → in_progress), do the work, mark
           complete (TaskUpdate → completed), and message the lead
           with your findings. Then go idle and wait for next message.

           You stay alive and accumulate codebase knowledge across tasks.
           Each scout task gets faster as you learn the codebase map."
```

```
# For guard (first spawn)
Task(feature-sprint:guard)
  team_name: TEAM_NAME
  name: "guard"
  prompt: "You are the Guard in a long-lived development session.
           Goal: {{ goal }}

           YOU ARE MESSAGE-DRIVEN. Do NOT poll TaskList.
           When PM or lead messages you, check TaskList for your tasks,
           claim them, identify risks, mark complete, and message lead
           with your Risk Brief. Then go idle and wait.

           You stay alive and remember risks from previous tasks.
           Flag if a new task re-introduces a previously identified risk."
```

```
# For tester (first spawn)
Task(feature-sprint:tester)
  team_name: TEAM_NAME
  name: "tester"
  prompt: "You are the Tester in a long-lived development session.
           Goal: {{ goal }}

           YOU ARE MESSAGE-DRIVEN. Do NOT poll TaskList.
           When PM or lead messages you, check TaskList for your tasks,
           claim them, define test strategy, mark complete, and message
           lead with your Test Brief. Then go idle and wait.

           You stay alive and track cumulative test coverage across tasks."
```

```
# For impl-1 (first spawn)
Task(feature-sprint:implementer)
  team_name: TEAM_NAME
  name: "impl-1"
  prompt: "You are Implementer-1 in a long-lived development session.
           Goal: {{ goal }}

           YOU ARE MESSAGE-DRIVEN. Do NOT poll TaskList.
           When PM or lead messages you about a new task:
           1. Check TaskList for tasks assigned to you (owner='impl-1')
           2. Claim it: TaskUpdate(status: 'in_progress')
           3. Implement following the task description
           4. Write unit tests (MANDATORY — every task must have tests)
           5. Run build + unit tests. If they fail, fix before proceeding.
           6. Mark complete: TaskUpdate(status: 'completed')
           7. Message lead: 'Task done. [summary + test results]'
           8. Go idle and wait for next message

           REVIEWER FEEDBACK:
           If reviewer messages you with fix requests, apply fixes and
           message reviewer back directly when done.

           You accumulate codebase knowledge. Each task gets faster."
```

```
# For impl-2 (first spawn, only when LARGE)
Task(feature-sprint:implementer)
  team_name: TEAM_NAME
  name: "impl-2"
  prompt: "[Same as impl-1 but owner='impl-2']"
```

```
# For impl-3 (first spawn, only when needed)
Task(feature-sprint:implementer)
  team_name: TEAM_NAME
  name: "impl-3"
  prompt: "[Same as impl-1 but owner='impl-3']"
```

```
# For reviewer (first spawn)
Task(feature-sprint:reviewer)
  team_name: TEAM_NAME
  name: "reviewer"
  prompt: "You are the Reviewer in a long-lived development session.
           Goal: {{ goal }}

           YOU ARE MESSAGE-DRIVEN. Do NOT poll TaskList.
           When PM messages you about a review task:
           1. The review task is blockedBy implementation tasks
           2. Wait for PM or implementers to message you that impl is done
              (or check TaskList to see if blockers are completed)
           3. Claim review task: TaskUpdate(status: 'in_progress')
           4. Read all files from task description
           5. Review for correctness, integration, quality

           FEEDBACK LOOP (max 2 rounds):
           - BLOCKERs: message the specific implementer directly
           - Wait for their fix confirmation
           - Re-read and verify
           - After resolution or 2 rounds: message lead with final report

           You stay alive and track recurring patterns across reviews."
```

After spawning, update ALIVE_AGENTS and let PM know:
```
SendMessage(to: "pm", message: "[agent-name] is now alive and ready.")
```

### 3. Route by Scope

- **TINY**: Do it yourself (lead), present to user
- **SMALL/MEDIUM/LARGE**: Agents are alive and PM already messaged them. Wait for completion reports.
- **HUGE**: Present PM's decomposition to user for decision

### 4. Wait for Completion

Agents message lead when done:
- impl-1/impl-2/impl-3: "Task done. [summary]"
- reviewer: "Review complete. [PASS/FAIL + details]"

Collect all reports, then present to user.

---

## Main Loop: Process User Input

After presenting results, wait for user input via AskUserQuestion:

```
Task complete. What's next?
- Type a new task or feature request
- Give feedback on the implementation
- "done" to end the session
```

### When user gives a NEW TASK:

```
SendMessage(to: "pm", message: "New task: [user's input]")
```

PM assesses, creates tasks, requests agents. Follow Lead Response Handler.

### When user gives FEEDBACK or TWEAKS:

Small corrections on just-modified code (skip PM):

1. Create impl task directly: TaskCreate with feedback
2. Message impl-1: `SendMessage(to: "impl-1", message: "Quick fix task created. Check TaskList.")`
3. If non-trivial, create review task too and message reviewer when impl completes

**How to decide**: References specific recent code → skip PM. New scope → send to PM.

### When user says "DONE":

Go to **Teardown**.

---

## Teardown

1. Present session summary:
   ```
   Session Summary:
   - Tasks completed: [count from TaskList]
   - Files modified: [list]
   - Agents used: [list from ALIVE_AGENTS]
   - Review status: [all approved / issues remaining]
   ```

2. Send shutdown_request to ALL agents in ALIVE_AGENTS
3. Wait for confirmations
4. TeamDelete(team_name: TEAM_NAME)
5. DONE

---

## Error Handling

- If PM goes idle: resume or respawn
- If agent fails mid-task: present partial work, ask user
- If reviewer fails: skip review for this round
- If spawned agent doesn't respond to message: check if alive, respawn if needed
- Always cleanup team on any exit path

## Architecture Summary

```
/sprint-loop "build user profile"
    |
    TeamCreate + spawn PM only
    |
    Task 1: "build user profile page"
    |   Lead -> PM (scope: MEDIUM, needs: impl-1,reviewer)
    |   Lead spawns impl-1 + reviewer (first time)
    |   PM messages impl-1 -> impl-1 works -> done
    |   PM messages reviewer -> blocked -> impl done -> reviewer works -> done
    |   Lead <- reports
    |
    Task 2: "add avatar upload with API"
    |   Lead -> PM (scope: LARGE, needs: scout,guard,impl-1,impl-2,reviewer)
    |   Lead spawns scout + guard + impl-2 (first time; impl-1 + reviewer already alive)
    |   PM messages all -> work in parallel -> done
    |   Lead <- reports
    |
    Task 3: "fix the button color"
    |   Lead -> impl-1 directly (skip PM, quick tweak)
    |   impl-1 fixes -> done
    |   (scout, guard, impl-2, reviewer all idle = zero cost)
    |
    Task 4: "add form validation"
    |   Lead -> PM (scope: MEDIUM, needs: impl-1,reviewer)
    |   Both already alive! PM messages them -> they wake up -> done
    |   (scout, guard, impl-2 still idle = still free)
    |
    "done" -> Teardown all
```

**v3 key changes**:
- Message-driven: agents wake on SendMessage, not by polling
- Dynamic scaling: spawn on first need, never kill (idle = free)
- PM requests agents: lead doesn't guess, PM specifies AGENTS_NEEDED
- Lean start: only PM at boot, everything else on demand
