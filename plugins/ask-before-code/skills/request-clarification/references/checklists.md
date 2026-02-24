# Completeness Checklists

Use these checklists to assess how complete a request is before deciding whether to trigger clarification.

## Feature Request Checklist

| # | Criterion | Weight | Check |
|---|-----------|--------|-------|
| 1 | Module/area of system identified | Required | [ ] |
| 2 | Target users specified | Required | [ ] |
| 3 | Business outcome / problem to solve | Required | [ ] |
| 4 | Success criteria (how to know it's done) | Important | [ ] |
| 5 | Priority / timeline | Nice-to-have | [ ] |
| 6 | Edge cases or constraints mentioned | Nice-to-have | [ ] |

**Scoring:**
- All 3 Required = 60% (minimum to proceed with caution)
- Required + Important = 80% (safe to proceed)
- All checked = 100% (ideal)

## Bug Report Checklist

| # | Criterion | Weight | Check |
|---|-----------|--------|-------|
| 1 | Module/feature affected | Required | [ ] |
| 2 | Expected behavior | Required | [ ] |
| 3 | Actual behavior | Required | [ ] |
| 4 | Reproduction steps | Important | [ ] |
| 5 | Severity / impact | Important | [ ] |
| 6 | Environment (prod/staging/dev) | Important | [ ] |
| 7 | When it started / frequency | Nice-to-have | [ ] |

**Scoring:**
- All 3 Required = 50% (need more info)
- Required + 2 Important = 75% (borderline)
- Required + all Important = 85% (safe to proceed)

## Improvement / Refactor Checklist

| # | Criterion | Weight | Check |
|---|-----------|--------|-------|
| 1 | Area/files to improve | Required | [ ] |
| 2 | Current pain point | Required | [ ] |
| 3 | Desired outcome | Required | [ ] |
| 4 | Business justification | Important | [ ] |
| 5 | Scope boundaries (what NOT to change) | Nice-to-have | [ ] |

## Decision Matrix

```
Score < 60%  → TRIGGER clarification immediately
Score 60-79% → ASK user: "Want to clarify or proceed?"
Score >= 80% → ALLOW proceeding (requirements clear enough)
```

## What to Ask Based on Gaps

| Missing | Ask About |
|---------|-----------|
| Module | "Which area of the system?" |
| Users | "Who will use this?" |
| Outcome | "What problem does this solve?" |
| Criteria | "How will we know it's done?" |
| Expected behavior | "What should happen?" |
| Actual behavior | "What happens instead?" |
| Reproduction | "Can you reproduce? Steps?" |
| Severity | "How many users affected?" |
| Environment | "Production or dev?" |
| Priority | "How urgent is this?" |

## Anti-Patterns

Things that indicate low clarity even if the request seems long:

- **Buzzword-heavy**: "We need a scalable, cloud-native, AI-powered solution" (what does it actually DO?)
- **Solution-first**: "Add a Redis cache" (what PROBLEM are we solving?)
- **Copy-paste from PM**: Long Jira ticket with no technical context
- **AND-chaining**: "Fix X AND add Y AND refactor Z" (which one first?)
- **Assumed context**: "You know the feature I mentioned" (which one?)
