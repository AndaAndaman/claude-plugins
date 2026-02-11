---
name: implementation-execution
description: |
  How the Implementer agent executes work packages - reading briefs, applying mitigations, file ownership, and interface contracts.
  Use when implementing features as part of a sprint team.

  Triggers: "implement work package", "file ownership", "interface contract", "apply mitigation", "implementation execution"
---

# Implementation Execution

## Purpose

Guide the Implementer agent through reading briefs, applying risk mitigations, maintaining file ownership boundaries, and coordinating interface contracts with other implementers.

## Reading the Brief

Your task description contains everything you need:

1. **Files you own** - Only touch these files
2. **Pattern reference** - Read this file first, match its style exactly
3. **Risk mitigations** - Apply these during implementation
4. **Feature context** - What the code should accomplish

## Applying Risk Mitigations

For each risk in the brief:

1. **Identify where** - Which of your files is affected by this risk?
2. **Implement the mitigation** - Follow the specific mitigation described
3. **Verify** - Re-read your code to confirm the mitigation is present

Example:
```
Risk: "Auth tokens remain in localStorage after logout"
Mitigation: "Clear all auth-related localStorage keys"

→ In your logout handler:
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
```

## File Ownership Rules

- Your task lists specific files - these are YOURS exclusively
- No other implementer will touch your files
- If you discover you need a file not in your list, message the team lead
- If another implementer needs something from your files, they'll message you

## Interface Contracts

When your code depends on another implementer's work:

### Proposing a Contract
```
Message to implementer-2:
"I need to call logout() from auth.service.ts.
Proposing: `async logout(): Promise<void>` that clears tokens and session.
Does this match what you're implementing?"
```

### Accepting a Contract
```
Message to implementer-1:
"Confirmed. logout() will be `async logout(): Promise<void>`.
It clears localStorage keys: token, refreshToken, user.
Also dispatches a 'session-ended' event."
```

### If No Response
If the other implementer hasn't responded within your implementation:
- Use a reasonable default interface
- Document your assumption in the completion message
- The reviewer will catch mismatches

## Completion Checklist

Before marking your task complete:
- [ ] All assigned files are created/modified
- [ ] Pattern reference style is followed
- [ ] All applicable risk mitigations are implemented
- [ ] Code compiles (no obvious syntax errors)
- [ ] Interface contracts are satisfied
- [ ] Completion message sent to team lead
