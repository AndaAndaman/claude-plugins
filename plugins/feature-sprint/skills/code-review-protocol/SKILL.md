---
name: code-review-protocol
description: |
  How the Reviewer agent checks implementers' code against the sprint brief - review checklist, risk verification, and approval flow.
  Use when reviewing code produced by sprint implementers.

  Triggers: "review code", "check implementation", "verify mitigations", "code review", "review protocol"
---

# Code Review Protocol

## Purpose

Guide the Reviewer agent through verifying all implementers' code against the sprint brief - checking risk mitigations, pattern compliance, cross-implementer consistency, and code quality.

## Review Priority Order

1. **Risk mitigations** - Are all mitigations from the brief actually implemented?
2. **Brief compliance** - Does the code do what the brief says?
3. **Cross-implementer consistency** - Do the work packages fit together?
4. **Pattern compliance** - Does the code follow the reference pattern?
5. **Code quality** - Are there bugs, security issues, or obvious problems?

## Checking Risk Mitigations

For each risk in the brief:

1. Find the relevant file(s)
2. Search for the mitigation implementation
3. Verify it's correct (not just present but actually effective)

```
Risk: "Token not cleared on logout"
Mitigation: "Clear all auth localStorage keys"

CHECK: Search for localStorage.removeItem in the logout handler
VERIFY: All auth-related keys are included (token, refreshToken, etc.)
RESULT: APPLIED or MISSING
```

## Cross-Implementer Review

When multiple implementers worked on the feature:

1. **Read all completion messages** from TaskList
2. **Check interface contracts** - Do the function signatures match?
3. **Check imports** - Do files import from each other correctly?
4. **Check data flow** - Does data pass correctly between modules?

## Issue Severity

### BLOCKER (Must Fix)
- Missing risk mitigation
- Bug that would cause feature to fail
- Security vulnerability
- Interface mismatch between implementers

### SUGGESTION (Nice to Have)
- Code style inconsistency
- Missing error message
- Suboptimal approach (works but could be better)
- Missing comment on non-obvious code

## Feedback Loop (Max 2 Rounds)

When BLOCKERs are found, resolve them directly with the implementer before reporting to the lead:

### Round 1: Report Issue
Message the **specific implementer** responsible:

```
BLOCKER in `src/auth.service.ts`:
The logout() function clears 'token' but not 'refreshToken'.
Brief mitigation requires clearing ALL auth keys.
Fix: Add `localStorage.removeItem('refreshToken')` after line 42.
```

### Round 2: Verify Fix
- Wait for implementer to confirm the fix
- Re-read the file to verify
- If still broken, send one more fix request (max 2 rounds)
- If resolved, move to next issue or finalize

### After 2 Rounds
If still unresolved, include in final report as "unresolved blocker" for user intervention.

## Approval Flow

### APPROVED
All mitigations present, no blockers, code matches brief.
Message team lead: "APPROVED - all checks pass."

### APPROVED WITH SUGGESTIONS
No blockers (all resolved via feedback loop), but suggestions for improvement.
Message team lead with approval + suggestion list.

### UNRESOLVED
Blockers remain after 2 feedback rounds.
Message team lead with unresolved issues for manual fix.

## Guidelines

- Be pragmatic - this is MVP, not perfection
- Focus on what the brief asked for, not what you'd do differently
- Don't block on style preferences
- Trust the brief's risk assessment
- If the implementation matches the brief, it's correct
