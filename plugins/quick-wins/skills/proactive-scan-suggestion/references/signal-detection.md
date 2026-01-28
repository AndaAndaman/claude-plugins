# Signal Detection Reference

## Exclusion Criteria (Skip if ANY present)

### Active Development Indicators
- User is actively coding or debugging
- User asks follow-up questions about implementation
- Error messages or compilation failures present
- User says "let me try...", "working on...", "fixing..."

### Change Scope Exclusions
- **Only documentation modified:** `.md`, `.txt`, `.rst`, `README` files
- **Only config modified:** `.json`, `.yaml`, `.yml`, `.xml`, `.toml`, `.ini`
- **Only build/tooling:** `package.json`, `tsconfig.json`, `.gitignore`, `.editorconfig`
- **Small changes:** Single-line edits, typo fixes, comment updates

### Urgency Indicators
- Keywords: "urgent", "critical", "hotfix", "emergency", "production down"
- Keywords: "quick fix", "asap", "immediately", "right now"
- User rushing through changes
- User mentions time pressure or deadlines

### Explicit Decline Signals
- User previously said: "skip scan", "no quick wins", "not now", "later"
- User said: "don't scan", "skip review", "no need to check"
- User declined similar suggestion recently

### Temporal Exclusions
- Quick wins scan already performed in last 5 conversation turns
- User just reviewed or ran quick wins command
- Scan was suggested and declined recently

### No Changes Made
- No Write, Edit, or NotebookEdit tool calls in conversation
- User only read files or explored code
- User only ran bash commands without modifying code

## Strong Completion Signals (1+ triggers suggestion)

### Explicit Completion Statements
- "done"
- "finished"
- "ready"
- "looks good"
- "that's it"
- "all set"
- "complete"
- "completed"

### Commit Intent Keywords
- "ready to commit"
- "let's commit"
- "commit this"
- "commit these changes"
- "time to commit"
- "should we commit"

### Next Steps Queries
- "what's next?"
- "what should I do now?"
- "anything else?"
- "what else?"
- "now what?"
- "what do you recommend next?"

### Testing Complete Indicators
- "tests pass"
- "all tests passing"
- "all green"
- "tested and working"
- "tests are good"
- "no test failures"

### Deployment/Release Indicators
- "ready to deploy"
- "push to prod"
- "ready for production"
- "ready to release"
- "let's deploy this"

### Task Completion (System-level)
- All tasks in task list marked as completed
- User explicitly says task is complete
- Feature implementation fully done

## Moderate Completion Signals (2+ trigger suggestion)

### Feature Completeness
- User implemented planned functionality
- All acceptance criteria met
- User mentions feature is "working" or "functional"
- No outstanding bugs or issues mentioned

### Change Volume
- **3+ code files modified** (TypeScript, JavaScript, C#, Angular)
- **Substantial changes:** 50+ lines of code added/modified
- **New files created:** New components, services, controllers

### Refactoring Complete
- User finished refactoring a module/component
- Code restructuring complete
- Migration to new pattern finished

### Review Behavior
- User runs `git diff` to review changes
- User re-reads modified files
- User checks what files were changed
- User verifies implementation

### Quality Check Interest
- User mentions "before committing"
- User asks about "best practices"
- User mentions "code quality"
- User asks "is this good?" or "does this look right?"

## Context Analysis Techniques

### Conversation Flow Patterns

**Pattern: Natural Completion**
```
User: [implements feature]
Assistant: [helps with implementation]
User: "Looks good, tests pass"
→ STRONG SIGNAL: Suggest scan
```

**Pattern: Next Steps Query**
```
User: [completes task]
User: "What should I do next?"
→ STRONG SIGNAL: Suggest scan before moving on
```

**Pattern: Pre-Commit**
```
User: [makes changes]
User: "Ready to commit this"
→ STRONG SIGNAL: Suggest scan before commit
```

**Pattern: Mid-Development**
```
User: [trying to fix bug]
User: "Still not working, let me try X"
→ EXCLUSION: Do not interrupt debugging
```

### File Modification Tracking

**Track these tool calls:**
- `Write` - New files or complete rewrites
- `Edit` - Modifications to existing files
- `NotebookEdit` - Jupyter notebook changes

**Extract from tool calls:**
- File paths modified
- File types (`.ts`, `.cs`, `.js`, etc.)
- Number of files changed
- Scope of changes (lines added/removed)

**Categorize changes:**
- Code files: `.ts`, `.tsx`, `.js`, `.jsx`, `.cs`, `.component.ts`, `.service.ts`
- Documentation: `.md`, `.txt`, `.rst`
- Config: `.json`, `.yaml`, `.xml`

### Timing Considerations

**Good times to suggest:**
- After user completes a substantial chunk of work
- Before user starts a new task
- When user asks "what's next?" or similar
- Right before commit/deployment

**Bad times to suggest:**
- In the middle of a debugging session
- During rapid iteration (multiple small changes)
- When user is exploring/learning the codebase
- When user is in "flow state" (actively coding)

## Edge Cases

### Ambiguous Signals

**User says: "done for now"**
- Could mean: Taking a break, or work is complete
- Action: Check for other signals (commit intent, tests passing)
- If unclear: Skip suggestion

**User asks: "what do you think?"**
- Could mean: Review request, or seeking validation
- Action: Check if code changes were made
- Consider suggesting review + quick wins scan

**User says: "this works"**
- Could mean: Partial progress, or complete
- Action: Check for "what's next" follow-up
- If user continues working: Don't suggest yet

### Repeated Patterns

**User consistently declines scans:**
- Stop suggesting proactively
- Wait for explicit `/quick-wins` invocation
- User may prefer manual control

**User always accepts scans:**
- Continue proactive suggestions
- Maintain timing sensitivity
- User appreciates the help

### Technology-Specific Signals

**Angular Development:**
- "Component works" + "Tested in browser" → Moderate signal
- "Added lifecycle hooks" → Feature complete indicator

**.NET Development:**
- "API endpoint works" + "Swagger updated" → Strong signal
- "Build successful" → Moderate signal

**General:**
- "Pushed to branch" → Strong signal (but late - suggest before commit)
- "PR created" → Too late (should have scanned before)
