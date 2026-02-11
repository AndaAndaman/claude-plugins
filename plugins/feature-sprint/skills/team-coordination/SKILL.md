---
name: team-coordination
description: |
  How sprint teammates coordinate using Agent Teams - task claiming, messaging, challenges, and shutdown.
  Use when coordinating between multiple agents in a sprint team.

  Triggers: "team coordination", "agent messaging", "task claiming", "challenge protocol", "shutdown protocol"
---

# Team Coordination

## Purpose

Define how sprint teammates coordinate using Agent Teams infrastructure - task claiming, metadata patterns, messaging guidelines, and challenge protocols.

## Task Claiming Protocol

1. Check `TaskList` for unblocked, unowned tasks
2. Claim with `TaskUpdate(taskId, owner: "your-name")`
3. Set status to `in_progress` when starting
4. Set status to `completed` when done

## Metadata Patterns

Tasks carry structured data in their description field:

```markdown
## Work Package

**Files**: `src/auth.service.ts`, `src/auth.guard.ts`
**Brief**: [embedded implementation brief]
**Pattern**: Follow `src/user.service.ts`
**Mitigations**: Clear tokens on logout, validate redirect URL
```

## Messaging Guidelines

### When to Message
- **Interface contracts**: "What function signature are you using for X?"
- **Conflicts detected**: "I see you're also touching file Y - can we coordinate?"
- **Clarification needed**: "The brief says X but I found Y - which is correct?"
- **Completion**: "Done with my package. Files: A, B. Mitigations applied: 1, 2."

### When NOT to Message
- Status updates (use TaskUpdate instead)
- Asking permission (you have your assignment, just do it)
- Sharing your full code (they can read the files)

### Message Format
Keep messages short and actionable:
```
"I need the logout() function to return a Promise<void> and clear localStorage.
Using: `async logout(): Promise<void>`. Can you confirm this matches your implementation?"
```

## Challenge Protocol (Analysts Only)

During analysis phase, analysts can challenge each other:

1. **Scout → Guard**: "I found the target at X, any risks specific to that location?"
2. **Guard → Tester**: "Risk #2 about token handling - is this testable with your suggested approach?"
3. **Tester → Scout**: "The test needs access to X - is that exposed from the target location?"

Challenges improve the brief quality. Keep them focused and constructive.

## Shutdown Protocol

When the team lead sends a shutdown request:
1. Finish current atomic operation (don't leave files half-written)
2. Update any in-progress tasks
3. Respond with `shutdown_response(approve: true)`

## File Ownership Rules

- Each implementer owns exclusive files listed in their task
- NEVER modify another implementer's files
- If you need changes in their files, message them
- The reviewer reads all files but modifies none
