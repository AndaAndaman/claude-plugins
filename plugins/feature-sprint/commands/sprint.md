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

**Feature**: {{ feature }}
**Plan Only**: {{ plan-only | default: false }}

## Execution Steps

### Step 1: Parallel Analysis

**CRITICAL**: You MUST spawn all 3 agents in a SINGLE message with multiple Task tool calls. This ensures true parallel execution.

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

Wait for all three to complete before proceeding.

### Step 2: Synthesize Implementation Brief

After receiving all 3 briefs, combine them into this format:

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
3. **[Risk]** - [Mitigation]

## ✅ Verification (from Tester)
Manual:
- [ ] [Step 1]
- [ ] [Step 2]
- [ ] [Step 3]

Automated: `[test file suggestion]`

## 🔧 Implementation Checklist
1. [ ] [First task based on location + risks]
2. [ ] [Second task]
3. [ ] [Third task]
4. [ ] Run verification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 3: User Decision

If `--plan-only` is true:
- Present the brief and STOP
- Do not ask about implementation

Otherwise, ask:
```
Ready to implement? [Y/n]
```

### Step 4: Implementation (if approved)

Follow the implementation checklist:
1. Read the target file (if modifying) or pattern reference file
2. Make changes following the identified pattern
3. Address each risk's mitigation during implementation
4. After code is written, guide through manual verification steps
5. Suggest running the automated test

## Error Handling

If any agent fails or returns incomplete results:
- Note which perspective is missing in the brief
- Proceed with available information
- Flag the gap clearly

## Examples

```bash
# Full sprint: analyze + implement
/sprint "Add logout button to header menu"

# Analysis only: get implementation brief
/sprint "Add dark mode toggle" --plan-only

# Shorthand for plan-only
/sprint-plan "Add email validation to signup form"
```
