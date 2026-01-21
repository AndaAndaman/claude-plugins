---
name: clarify
description: Clarify requirements for a vague or incomplete request before coding begins
args:
  - name: topic
    description: Optional topic or context to clarify (e.g., "login feature", "payment bug")
    required: false
---

# Clarify Requirements Command

## Purpose

This command helps gather complete, clear requirements before writing code. Use it when:
- User request is vague or incomplete
- Multiple interpretations possible
- Missing essential context (module, users, success criteria)
- Want to prevent wasted development effort

## Usage

```bash
# Clarify recent conversation context
/clarify

# Clarify specific topic
/clarify login feature
/clarify payment bug
/clarify report requirements
```

## How It Works

When invoked, this command:

1. **Analyzes Context**: Reviews recent conversation or specified topic
2. **Identifies Gaps**: Determines what context is missing
3. **Asks Questions**: Uses interactive AskUserQuestion for efficient clarification
4. **Confirms Understanding**: Validates gathered requirements
5. **Generates Action Plan**: Outputs clear, actionable plan

## Execution Instructions

### Step 1: Determine Scope

```typescript
IF topic provided:
  Focus clarification on specified topic
  Example: "/clarify login feature" → clarify login-related requirements
ELSE:
  Analyze recent conversation (last 3-5 messages)
  Identify the most recent unclear request
```

### Step 2: Classify Request Type

Identify what type of request this is:

- **Feature**: New functionality ("add", "create", "build")
- **Bug**: Something broken ("error", "doesn't work", "crash")
- **Improvement**: Enhancement ("optimize", "better", "refactor")
- **Question**: Seeking understanding ("how", "why", "what")
- **Urgent**: Time-sensitive issue ("URGENT", "production down")

### Step 3: Identify Missing Context

Check what essential context is missing:

**For Features:**
- [ ] Module/area of system
- [ ] Target users
- [ ] Business outcome desired
- [ ] Success criteria
- [ ] Priority/timeline

**For Bugs:**
- [ ] Module/feature affected
- [ ] Expected behavior
- [ ] Actual behavior
- [ ] Reproduction steps
- [ ] Severity/impact
- [ ] Environment

**For Improvements:**
- [ ] Area to improve
- [ ] Current pain point
- [ ] Desired outcome
- [ ] Business justification

### Step 4: Ask Efficient Questions

Use `AskUserQuestion` tool to gather missing context:

**Rules:**
- Ask 2-3 questions MAX
- Use multiple-choice options
- Group related questions
- Make it easy to answer

**Example Question Structure:**

```typescript
AskUserQuestion({
  questions: [
    {
      question: "Which area of the system is this for?",
      header: "Module",
      multiSelect: false,
      options: [
        { label: "Authentication", description: "Login, registration, passwords" },
        { label: "Data Management", description: "CRUD, validation, storage" },
        { label: "User Interface", description: "Frontend, components, layouts" },
        { label: "API/Backend", description: "Server logic, endpoints" }
      ]
    },
    {
      question: "Who will use this?",
      header: "Users",
      multiSelect: true,
      options: [
        { label: "End Users", description: "Primary application users" },
        { label: "Administrators", description: "System admins" },
        { label: "Developers", description: "Technical team" }
      ]
    },
    {
      question: "What's the priority?",
      header: "Priority",
      multiSelect: false,
      options: [
        { label: "CRITICAL", description: "Production issue, immediate fix needed" },
        { label: "HIGH", description: "Important, needed soon" },
        { label: "MEDIUM", description: "Normal priority" },
        { label: "LOW", description: "Nice to have, can wait" }
      ]
    }
  ]
})
```

### Step 5: Confirm Understanding

After gathering responses, confirm with user:

```
"Got it! Let me confirm my understanding:

**Request Type:** [Feature/Bug/Improvement]
**Module:** [Specific module/area]
**Users:** [Target users]
**Outcome:** [What should happen]
**Success Criteria:**
  - [Criterion 1]
  - [Criterion 2]
  - [Criterion 3]

Is this correct?"
```

### Step 6: Generate Action Plan

Output clear, actionable plan:

```
"Perfect! Here's the action plan:

## Summary
[1-2 sentence summary of what will be built/fixed]

## Requirements
- **Module:** [Specific module/component]
- **Users:** [Who will use this]
- **Priority:** [CRITICAL/HIGH/MEDIUM/LOW]

## Acceptance Criteria
1. [Specific, measurable criterion]
2. [Specific, measurable criterion]
3. [Specific, measurable criterion]

## Implementation Approach
1. [High-level step 1]
2. [High-level step 2]
3. [High-level step 3]

## Next Steps
[What happens next - start coding, get approval, etc.]

Ready to proceed? ✓"
```

## Communication Style

**Tone:**
- Friendly and helpful ("I can help clarify!")
- Efficient (respect user's time)
- Clear (avoid jargon unless user is technical)
- Positive ("Let's make sure we get this right")

**Language Patterns:**

✅ **Good:**
```
"I can help! Quick questions to clarify..."
"Got it! Let me confirm my understanding..."
"Perfect! Here's what I'll build..."
"Great! A few clarifications before we start..."
```

❌ **Bad:**
```
"ERROR: Insufficient information"
"You must provide..."
"This request is unclear"
"I cannot proceed without..."
```

## Examples

### Example 1: General Clarification

**Command**: `/clarify`

**Output**:
```
I see you mentioned needing a "report feature" earlier. Let me clarify the requirements:

[AskUserQuestion with 3 questions about module, users, format]

[After responses...]

Got it! Business data report for managers with Excel export.

Here's the action plan:
[... detailed plan ...]
```

---

### Example 2: Topic-Specific Clarification

**Command**: `/clarify login bug`

**Output**:
```
I'll help clarify the login bug requirements:

[AskUserQuestion with 3 questions about what's broken, environment, severity]

[After responses...]

Understood! Login form crashes with special characters in production.

Here's the action plan:
[... detailed plan ...]
```

---

### Example 3: Feature Clarification

**Command**: `/clarify dashboard feature`

**Output**:
```
Let me clarify the dashboard feature requirements:

[AskUserQuestion about which data, target users, update frequency]

[After responses...]

Perfect! Real-time performance dashboard for administrators.

Here's the action plan:
**Module:** Admin Dashboard
**Users:** System Administrators
**Priority:** HIGH

**Acceptance Criteria:**
1. Display real-time system metrics (CPU, memory, requests/sec)
2. Auto-refresh every 30 seconds
3. Alert visual indicators when thresholds exceeded

**Implementation Approach:**
1. Create dashboard component with metric widgets
2. Implement WebSocket connection for real-time data
3. Add threshold configuration panel
4. Implement alert system

Ready to start building! ✓
```

## Integration

This command:
- References the **request-clarification skill** for methodology
- Can invoke the **clarity-guardian agent** for advanced analysis
- Uses **AskUserQuestion tool** for interactive clarification
- Coordinates with **PreToolUse hook** to prevent unclear coding

## Success Criteria

Command succeeds when:
1. All essential context gathered (module, users, outcome, criteria)
2. User confirms understanding is correct
3. Clear, actionable plan generated
4. Confidence in requirements is 80%+
5. Ready to proceed with implementation

## Notes

- Keep questions to 2-3 MAX (don't overwhelm)
- Use multiple-choice when possible
- Adapt language to user's technical level
- Focus on business value, not just technical details
- Generate concrete, measurable acceptance criteria
