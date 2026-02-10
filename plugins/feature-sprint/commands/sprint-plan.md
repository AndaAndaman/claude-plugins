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

**Feature**: {{ feature }}
**Plan Only**: true (always)

## Execution Steps

### Step 1: Parallel Analysis

**CRITICAL**: Spawn all 3 agents in a SINGLE message with multiple Task tool calls:

```
🔍 Analyzing feature: "{{ feature }}"
   ├─ 🗺️ Scout: Finding location...
   ├─ 🛡️ Guard: Checking risks...
   └─ ✅ Tester: Defining verification...
```

**In ONE message, call all three:**

```
Task(feature-sprint:scout)
  prompt: "Scout the codebase for: {{ feature }}
           Find: target file, related files (max 3), pattern to follow.
           Return a Location Brief."

Task(feature-sprint:guard)
  prompt: "Identify risks for: {{ feature }}
           Find: max 3 critical risks with mitigations.
           Return a Risk Brief."

Task(feature-sprint:tester)
  prompt: "Define test strategy for: {{ feature }}
           Find: manual verification steps (max 5), one automated test suggestion.
           Return a Test Brief."
```

Wait for all three to complete.

### Step 2: Synthesize Implementation Brief

Combine the 3 briefs into unified format:

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 IMPLEMENTATION BRIEF: [Feature Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📍 Location (from Scout)
**Target**: `[primary file path]`
**Type**: [Create New | Modify Existing]
**Pattern**: Follow `[reference file]`

Related Files:
• `[file1]` - [why]
• `[file2]` - [why]

## ⚠️ Risks (from Guard)
1. **[Risk]** - [Mitigation]
2. **[Risk]** - [Mitigation]

## ✅ Verification (from Tester)
Manual:
- [ ] [Step 1]
- [ ] [Step 2]
- [ ] [Step 3]

Automated: `[test file suggestion]`

## 🔧 Implementation Checklist
1. [ ] [First task]
2. [ ] [Second task]
3. [ ] [Third task]
4. [ ] Run verification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 3: Present and Stop

Present the brief. **Do NOT ask about implementation** - this is plan-only mode.

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
