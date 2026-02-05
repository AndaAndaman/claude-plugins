---
name: sprint-plan
description: "Create implementation brief only (no implementation). Alias for /sprint --plan-only"
arguments:
  - name: feature
    description: "Short description of the feature to analyze"
    required: true
allowed-tools:
  - Task
  - Read
  - Glob
  - Grep
---

# Sprint Plan Command

Create an implementation brief without executing implementation.

This is a shorthand for `/sprint "feature" --plan-only`.

## Execution

Launch the sprint-coordinator agent in plan-only mode:

```
Task(sprint-coordinator)
```

**Feature**: {{ feature }}
**Plan Only**: true

The coordinator will:
1. Spawn Scout, Guard, and Tester agents in parallel
2. Synthesize outputs into implementation brief
3. Present brief and stop (no implementation)

## Use Cases

- **Review before commit**: Get the plan, review with team, then implement manually
- **Learning**: Understand how to approach a feature
- **Documentation**: Generate implementation guide for handoff
- **Estimation**: Understand scope before committing to implementation

## Example

```bash
/sprint-plan "Add user avatar upload to profile settings"
```

Returns implementation brief with:
- Target files and patterns
- Risks and mitigations
- Verification steps
- Implementation checklist

No code changes are made.
