---
name: clarify
description: Clarify requirements for a vague or incomplete request before coding begins
argument-hint: "[topic]"
allowed-tools:
  - AskUserQuestion
  - Read
  - Glob
  - Grep
---

# Clarify Requirements Command

Gather complete, clear requirements before writing code.

## Usage

```bash
/clarify                    # Clarify recent conversation context
/clarify login feature      # Clarify specific topic
/clarify payment bug        # Gather bug details
```

## Process

### 1. Determine Scope

If topic argument provided: focus on that topic.
Otherwise: analyze recent conversation (last 3-5 messages) for the most recent unclear request.

### 2. Assess Completeness

Read the checklists and score the request:
- `skills/request-clarification/references/checklists.md`

Score against the relevant checklist (feature, bug, or improvement):
- **< 60%** → Clarify immediately (proceed to step 3)
- **60-79%** → Ask user: "Want to clarify or proceed as-is?"
- **>= 80%** → Tell user requirements look clear, offer to proceed

### 3. Ask Questions (2-3 max)

Use `AskUserQuestion` with multiple-choice options. Read templates from:
- `skills/request-clarification/references/question-templates.md`

**Rules:**
- 2-3 questions MAX, grouped not sequential
- Customize options based on conversation context
- Skip what you can already infer
- Make it easy to answer

### 4. Confirm Understanding

Summarize what you gathered:

```
Got it! Let me confirm:
- Module: [X]
- Users: [Y]
- Outcome: [Z]
- Success criteria: [W]

Is this correct?
```

### 5. Output Action Plan

```
**Feature/Fix:** [Clear description]
**Module:** [Specific module/component]
**Users:** [Who will use it]
**Acceptance Criteria:**
  1. [Criterion 1]
  2. [Criterion 2]
  3. [Criterion 3]
**Implementation approach:**
  - [Step 1]
  - [Step 2]
  - [Step 3]
```

## Tone

- Friendly: "I can help! Quick questions..." — never "ERROR: Insufficient information"
- Efficient: respect the user's time, don't over-question
- If the user says requirements are clear, respect that and proceed
