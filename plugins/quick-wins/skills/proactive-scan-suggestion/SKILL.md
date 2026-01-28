---
name: Proactive Scan Suggestion
description: Use this skill when the user asks "what's next?", "anything else?", "what should I do now?", or says "done", "finished", "ready", "ready to commit", "looks good", "tests pass", or when evaluating whether to proactively suggest a quick wins scan after code changes are complete. Provides decision framework for timely, non-intrusive scan suggestions at natural completion points.
version: 0.1.0
---

# Proactive Scan Suggestion

## Purpose

Determine when to proactively suggest quick wins scans at natural workflow completion points without interrupting active development.

## Decision Algorithm

Follow this process when considering a scan suggestion:

### Step 1: Check Exclusion Criteria

**DO NOT suggest if ANY of these conditions exist:**

- User is mid-development or debugging
- Only documentation/config files modified (`.md`, `.json`, `.yaml`, `.txt`)
- Small single-line changes or typo fixes
- Urgency indicators present: "urgent", "critical", "hotfix", "production issue"
- User explicitly declined: "skip scan", "no quick wins", "not now"
- Recent scan already performed (within last 5 conversation turns)
- No code files modified (no Write/Edit operations)

### Step 2: Evaluate Completion Signals

**Count signals present in conversation:**

**Strong Signals (1+ triggers suggestion):**
- User says: "done", "finished", "ready", "looks good", "that's it", "all set"
- Commit intent: "ready to commit", "let's commit", "commit this"
- Next steps query: "what's next?", "anything else?", "what should I do now?"
- Testing complete: "tests pass", "all green", "tested and working"
- Deployment mention: "ready to deploy", "push to prod"

**Moderate Signals (2+ trigger suggestion):**
- Feature implementation complete
- Multiple code files modified (3+ files)
- Substantial changes made (significant new code or refactoring)
- User reviewing changes (git diff, checking files)

### Step 3: Execute Decision

**If suggestion criteria met:**
1. Use natural phrasing from references/suggestion-phrasing.md
2. Mention specific files modified
3. Frame as helpful offer, not requirement
4. If user accepts → run `/quick-wins` command
5. If user declines → acknowledge and move on

**If uncertain:** Skip suggestion (better to miss than interrupt)

## Quick Reference

```
Exclusion criteria? → SKIP
Strong signal present (1+)? → SUGGEST
Moderate signals present (2+)? → SUGGEST
Otherwise → SKIP
```

## Integration with quick-wins-scanner

When user accepts suggestion:
- Invoke `/quick-wins` command
- Target files/directories modified in conversation
- Present findings using standard scanner output format

## Philosophy

**Helper, not blocker:** Suggest at right moments, respect user flow, accept "no" gracefully.

---

**For detailed signal definitions:** See references/signal-detection.md
**For phrasing examples:** See references/suggestion-phrasing.md
**For scenario examples:** See examples/suggestion-scenarios.md
