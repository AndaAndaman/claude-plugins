# Suggestion Phrasing Reference

## Core Principles

1. **Natural and conversational** - Sound like a helpful colleague, not a robot
2. **Context-aware** - Mention specific files or changes made
3. **Offer, don't demand** - Frame as helpful suggestion, not requirement
4. **Brief and actionable** - One or two sentences maximum
5. **Respect user autonomy** - Accept "no" gracefully

## Standard Phrasing Templates

### Template 1: File-Specific Suggestion

```
I noticed you modified [file1], [file2], and [file3]. Would you like me to run a quick wins scan to check for easy improvements?
```

**When to use:** Multiple specific files modified

**Example:**
```
I noticed you modified auth.service.ts, login.component.ts, and auth.guard.ts. Would you like me to run a quick wins scan to check for easy improvements?
```

### Template 2: Context-Aware Suggestion

```
Now that [feature/task] is complete, would you like me to scan the modified files for quick wins?
```

**When to use:** Clear feature or task completion

**Example:**
```
Now that the authentication feature is complete, would you like me to scan the modified files for quick wins?
```

### Template 3: Pre-Commit Suggestion

```
Before committing, should I check for any quick improvement opportunities in the files you changed?
```

**When to use:** User mentions commit intent

**Example:**
```
Before committing, should I check for any quick improvement opportunities in the 5 files you changed?
```

### Template 4: Next Steps Query Response

```
Before moving on, would you like me to scan [scope] for quick wins?
```

**When to use:** User asks "what's next?" or similar

**Example:**
```
Before moving on, would you like me to scan the refactored components for quick wins?
```

### Template 5: Testing Complete Follow-up

```
Great! Since tests are passing, would you like me to run a quick wins scan to ensure code quality before committing?
```

**When to use:** User confirms tests pass

**Example:**
```
Great! Since tests are passing, would you like me to run a quick wins scan to ensure code quality before committing?
```

## Phrasing Variations

### Casual Tone
- "Want me to check for quick wins before committing?"
- "Should I scan these files for easy improvements?"
- "Quick wins scan on the changes?"

### Professional Tone
- "Would you like me to perform a quick wins analysis on the modified files?"
- "Shall I scan for improvement opportunities before you commit?"
- "May I suggest running a quick wins scan on your recent changes?"

### Collaborative Tone (Recommended)
- "Before we move on, should we scan for quick wins?"
- "Let's check for easy improvements - should I run a quick wins scan?"
- "Want to do a quick quality check before committing?"

## Context-Specific Phrasing

### After Refactoring
```
The refactoring looks good. Would you like me to scan for any additional quick improvements while we're at it?
```

### Multiple Files Changed
```
I see you modified [N] files. Should I check them for quick wins before you commit?
```

### Before Deployment
```
Before deploying, would you like me to run a quick wins scan to catch any easy improvements?
```

### Feature Complete
```
The [feature name] feature is working well. Want me to scan for any quick polish opportunities?
```

### After Bug Fix
```
Bug fixed! Should I check the modified files for any other quick improvements?
```

## File Reference Formatting

### Few Files (1-3)
```
I noticed you modified auth.service.ts, login.component.ts, and auth.guard.ts.
```

### Several Files (4-6)
```
I noticed you modified auth.service.ts, login.component.ts, auth.guard.ts, and 3 other files.
```

### Many Files (7+)
```
I noticed you modified 8 files in the authentication module.
```

### Directory Scope
```
I noticed you made changes in the src/auth/ directory.
```

## Response Handling

### User Says Yes

**Immediate action:**
```
I'll scan those files for quick wins now.
```

Then invoke `/quick-wins` command with appropriate scope.

### User Says No / Later

**Acknowledge gracefully:**
```
No problem. Let me know if you'd like me to scan later.
```

Or simply:
```
Sounds good.
```

**Do NOT:**
- Ask why they declined
- Suggest again immediately
- Express disappointment
- Push or insist

### User Says "Just [specific category]"

**Example:**
```
User: "Just check for error handling issues"
```

**Response:**
```
I'll focus on error handling in the quick wins scan.
```

Then run `/quick-wins` with focus on that category.

### User Says "Skip this time"

**Acknowledge and remember:**
```
Got it. I'll skip the scan this time.
```

Don't suggest again in the same session unless significant new changes occur.

## What NOT to Say

### Avoid Pushy Language
❌ "You should really scan for quick wins"
❌ "It's important to check for improvements"
❌ "Don't forget to scan before committing"
❌ "You need to run quick wins"

### Avoid Over-Selling
❌ "This will only take 30 seconds!"
❌ "You'll definitely find issues"
❌ "This is critical for code quality"
❌ "Everyone does this before committing"

### Avoid Uncertainty
❌ "Maybe we could scan for quick wins?"
❌ "I'm not sure if you want to, but..."
❌ "If you have time, perhaps..."
❌ "It might be good to..."

### Avoid Assumptions
❌ "I know you want to check for improvements"
❌ "You probably want to scan before committing"
❌ "You always check for quick wins"

## Advanced Phrasing Techniques

### Combine with Next Steps

```
Before [next action], would you like me to scan for quick wins?
```

**Examples:**
- "Before starting the next feature, would you like me to scan for quick wins?"
- "Before creating the PR, should I check for quick improvements?"
- "Before you head out, want me to do a quick quality check?"

### Reference Specific Concerns

If user previously mentioned quality concerns:
```
Since you mentioned wanting cleaner code, should I scan for quick wins?
```

### Tie to User Goals

If user wants to improve practices:
```
As part of improving code quality, would you like me to scan these changes?
```

### Time-Sensitive Framing

When appropriate timing:
```
Good stopping point - should I check for quick wins before you commit?
```

## Tone Calibration

### Match User's Style

**User is casual:**
```
User: "Done! What's next?"
You: "Want me to check for quick wins first?"
```

**User is formal:**
```
User: "Implementation is complete. What should I do next?"
You: "Before proceeding, would you like me to perform a quick wins analysis?"
```

**User is brief:**
```
User: "Looks good"
You: "Scan for quick wins?"
```

### Energy Matching

**User is enthusiastic:**
```
User: "Yes! It works!"
You: "Awesome! Want me to scan for quick wins before you commit?"
```

**User is tired/rushed:**
```
User: "Finally done"
You: "Should I check for quick wins, or skip for now?"
```

## Examples in Context

### Example 1: Natural Completion

```
User: "Okay, that's working now. Tests pass."
Assistant: "Great! Since tests are passing, would you like me to run a quick wins scan before you commit?"
```

### Example 2: What's Next Query

```
User: "What should I do next?"
Assistant: "Before moving on, would you like me to scan the 4 files you modified for quick wins?"
```

### Example 3: Commit Intent

```
User: "Ready to commit this"
Assistant: "Before committing, should I check for any quick improvement opportunities?"
```

### Example 4: User Declines

```
User: "No, just commit it"
Assistant: "Got it."
[Proceed with commit, don't suggest scan]
```

### Example 5: User Accepts

```
User: "Sure, go ahead"
Assistant: "I'll scan those files for quick wins now."
[Run /quick-wins command]
```

## Integration Notes

- Always mention the **actual files or scope** modified when suggesting
- Use **present tense** and **active voice**
- Keep suggestions **under 25 words** when possible
- **One sentence** is often enough
- If user ignores the suggestion, don't repeat - assume "no"
