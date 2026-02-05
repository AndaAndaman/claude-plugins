---
name: sprint
description: "Quick MVP feature development with parallel analysis. Spawns Scout, Guard, and Tester agents to create an implementation brief, then implements the feature."
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
---

# Sprint Command

Execute a quick MVP feature development sprint with parallel analysis.

## What This Command Does

1. **Parallel Analysis** - Spawns 3 specialized agents simultaneously:
   - **Scout**: Finds target location and patterns
   - **Guard**: Identifies risks and mitigations
   - **Tester**: Defines verification strategy

2. **Synthesis** - Combines outputs into unified implementation brief

3. **Implementation** - Executes the plan (unless `--plan-only`)

4. **Verification** - Guides through test steps

## Execution

Launch the sprint-coordinator agent to handle the full workflow:

```
Task(sprint-coordinator)
```

Pass the feature description and any flags to the coordinator.

**Feature**: {{ feature }}
**Plan Only**: {{ plan-only | default: false }}

The sprint-coordinator will:
1. Parse the feature request
2. Spawn Scout, Guard, and Tester agents in parallel
3. Synthesize their outputs into an implementation brief
4. Ask for confirmation (unless auto-implement is enabled)
5. Implement the feature following the brief
6. Guide through verification steps

## Examples

```bash
# Full sprint: analyze + implement
/sprint "Add logout button to header menu"

# Analysis only: get implementation brief
/sprint "Add dark mode toggle" --plan-only

# Shorthand for plan-only
/sprint-plan "Add email validation to signup form"
```

## Output

The command produces an implementation brief like:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 IMPLEMENTATION BRIEF: Add Logout Button
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Location
   Target: src/components/Header/UserMenu.tsx
   Pattern: Follow LoginButton component

⚠️ Risks
   1. Token not cleared - Clear localStorage
   2. Redirect loop - Use public route /login

✅ Verification
   • Click logout → redirects to /login
   • localStorage cleared

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready to implement? [Y/n]
```
