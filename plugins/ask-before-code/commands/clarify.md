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

## When to Use

- User request is vague or incomplete
- Multiple interpretations possible
- Missing essential context (module, users, success criteria)
- Want to prevent wasted development effort

## Usage

```bash
/clarify                    # Clarify recent conversation context
/clarify login feature      # Clarify specific topic
/clarify payment bug        # Gather bug details
```

## Execution

Analyze the conversation context and gather requirements for the user's request.

If a topic argument was provided, focus clarification on that topic.
Otherwise, analyze recent conversation (last 3-5 messages) and identify the most recent unclear request.

Launch the clarity-guardian agent to handle the full clarification workflow:

Task(clarity-guardian)
