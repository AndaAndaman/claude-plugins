---
name: scope-assessment
description: Skill for assessing feature scope to determine the appropriate sprint workflow. Use when you need to size a feature before deciding how many agents to spawn. Triggers "assess scope", "feature size", "how big is this", "scope level", "sprint routing"
---

# Scope Assessment Skill

## Purpose

Quickly determine the **right-sized workflow** for a feature request. Not every feature needs the full analyst + implementer + reviewer pipeline. Match effort to complexity.

## Scope Levels

### Tiny
- **Criteria**: 1 file, trivial change (text, value, rename)
- **Examples**: Fix typo, update label, change constant value, correct spelling
- **Workflow**: Lead does it directly - no team, no agents
- **Time**: Under 1 minute

### Small
- **Criteria**: 1 file, simple logic addition or modification
- **Examples**: Add tooltip, add click handler, toggle visibility, add CSS class
- **Workflow**: Scout finds location → 1 implementer executes
- **Time**: 5-15 minutes

### Medium
- **Criteria**: 2-3 files in a focused area, coordinated changes
- **Examples**: Add feature with component + service, form with validation, new API endpoint with handler
- **Workflow**: Scout + Guard + Tester analyze → 1 implementer executes
- **Time**: 15-45 minutes

### Large
- **Criteria**: 4+ files across modules/layers, cross-cutting concerns
- **Examples**: File upload with UI + API + storage, dashboard with multiple widgets, multi-step workflow
- **Workflow**: Full team - Scout + Guard + Tester → 2-3 parallel implementers → reviewer
- **Time**: 45+ minutes

### Huge
- **Criteria**: System-wide changes, architectural shifts, 8+ files
- **Examples**: Framework migration, auth system rewrite, API protocol change, monolith decomposition
- **Workflow**: STOP - too large for single sprint, suggest decomposition
- **Time**: Should be broken into multiple sprints

## Assessment Signals

### From Feature Text

| Signal Words | Likely Scope |
|-------------|-------------|
| "fix typo", "rename", "update text" | tiny |
| "add button", "add tooltip", "toggle" | small |
| "add feature", "implement", "create" | medium |
| "with API", "upload", "integration", "workflow" | large |
| "migrate", "refactor all", "rewrite", "restructure" | huge |

### From Codebase Analysis

| Observation | Scope Implication |
|------------|-------------------|
| Change is in a single leaf file | tiny or small |
| Change touches a component and its service | medium |
| Change crosses module boundaries | large |
| Change affects shared infrastructure (auth, routing, state) | large or huge |
| Change requires new architectural patterns | huge |

### Cross-Cutting Concern Multipliers

These factors push scope UP by one level:
- Touches shared components used by 3+ consumers
- Requires database/schema changes
- Affects authentication or authorization flow
- Needs new third-party dependency
- Changes public API contract

## Decomposition Guidelines (for Huge)

When a feature is huge, break it into independent sprints:

1. **Find natural boundaries** - Each sub-feature should be independently deployable
2. **Identify the foundation** - What must be built first for others to build on
3. **Target medium scope** - Each sub-feature should be medium (2-3 files)
4. **Define interfaces** - Agree on contracts between sub-features before starting

### Decomposition Template

```
Original: "Migrate auth from sessions to JWT"

Decomposed:
1. (medium) Add JWT token generation to auth service
2. (medium) Add JWT validation middleware
3. (small) Update login endpoint to return JWT
4. (medium) Update protected routes to use JWT middleware
5. (small) Add token refresh endpoint
6. (small) Remove session code and dependencies
```

## Confidence Levels

- **High**: Clear signals from both text and codebase match
- **Medium**: Text suggests one level but codebase analysis shows different complexity
- **Low**: Ambiguous feature description, unfamiliar codebase area, or conflicting signals

When confidence is low, size UP and note the uncertainty in the brief.
