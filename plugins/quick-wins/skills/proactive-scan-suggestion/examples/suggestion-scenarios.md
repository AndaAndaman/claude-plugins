# Suggestion Scenarios

This document provides concrete examples of when to suggest (and when NOT to suggest) quick wins scans.

## ✅ Scenario 1: Natural Completion Signal

### Context
User has implemented a new Angular authentication feature involving multiple files.

### Conversation
```
User: "Okay, the login flow is working now. Tests pass."
```

### Analysis
- **Strong signal:** "working now", "Tests pass"
- **Files modified:** 3+ TypeScript/Angular files
- **No exclusions:** Not urgent, not mid-development

### Action
```
Assistant: "Great! I noticed you modified auth.service.ts, login.component.ts, and auth.guard.ts. Would you like me to run a quick wins scan before you commit?"
```

### If User Says Yes
```
Assistant: "I'll scan those files for quick wins now."
[Invoke /quick-wins command]
```

---

## ✅ Scenario 2: "What's Next?" Query

### Context
User completed refactoring a C# API controller and asks about next steps.

### Conversation
```
User: [completes refactoring 5 C# files]
User: "What should I do next?"
```

### Analysis
- **Strong signal:** "What should I do next?"
- **Files modified:** 5 C# files (substantial changes)
- **Moderate signals:** Refactoring complete

### Action
```
Assistant: "Before moving on, would you like me to scan the refactored controllers for quick wins? I see you modified 5 files in the API layer."
```

---

## ✅ Scenario 3: Pre-Commit Intent

### Context
User mentions they're ready to commit changes after implementing a feature.

### Conversation
```
User: "This looks good. Ready to commit."
```

### Analysis
- **Strong signals:** "looks good", "Ready to commit"
- **Files modified:** Multiple TypeScript files
- **Context:** Natural checkpoint before commit

### Action
```
Assistant: "Before committing, should I check for any quick improvement opportunities in the files you changed?"
```

---

## ✅ Scenario 4: Testing Complete

### Context
User ran tests after fixing a bug and confirms everything passes.

### Conversation
```
User: "Fixed the null reference bug. All tests green now."
```

### Analysis
- **Strong signal:** "All tests green"
- **Files modified:** Bug fix in 2 files
- **Context:** Bug resolved, good checkpoint

### Action
```
Assistant: "Great! Since tests are passing, would you like me to run a quick wins scan on the modified files to ensure quality before committing?"
```

---

## ✅ Scenario 5: Multiple Moderate Signals

### Context
User completed implementing a feature, modified several files, and is reviewing their changes.

### Conversation
```
User: [implements feature in 4 files]
User: [runs git diff to review changes]
User: "The feature is working"
```

### Analysis
- **Moderate signals (3):**
  - Feature working
  - Multiple files modified (4 files)
  - User reviewing changes (git diff)
- **No strong signals, but 3 moderate = suggest**

### Action
```
Assistant: "The implementation looks solid. Would you like me to scan the 4 modified files for quick wins before you commit?"
```

---

## ❌ Scenario 6: Mid-Development (Do NOT Suggest)

### Context
User is actively debugging an issue and trying different approaches.

### Conversation
```
User: "The API call is still failing. Let me try adding error handling."
[User modifies service file]
User: "Still not working. Maybe it's the headers?"
```

### Analysis
- **Exclusion criteria:** Mid-development, debugging active
- **No completion signals**
- **User is iterating, not done**

### Action
```
Assistant: [Help with debugging, do NOT suggest scan]
```

**Why:** User is in flow, actively problem-solving. Interrupting now would be frustrating.

---

## ❌ Scenario 7: Small Change (Do NOT Suggest)

### Context
User fixes a typo in a comment.

### Conversation
```
User: "Fixed the typo in the comment."
```

### Analysis
- **Exclusion criteria:** Small change (single-line edit)
- **No significant code modifications**

### Action
```
Assistant: "Done."
[Do NOT suggest scan - too minor]
```

**Why:** Quick wins scan is overkill for trivial changes.

---

## ❌ Scenario 8: Documentation Only (Do NOT Suggest)

### Context
User updates README and API documentation.

### Conversation
```
User: "Updated the README with the new setup instructions."
[Modified README.md, API-DOCS.md]
```

### Analysis
- **Exclusion criteria:** Only documentation files modified
- **No code files changed**

### Action
```
Assistant: "README updated successfully."
[Do NOT suggest scan - no code changes]
```

**Why:** Quick wins scan is for code, not documentation.

---

## ❌ Scenario 9: Urgency Present (Do NOT Suggest)

### Context
User is fixing a critical production bug under time pressure.

### Conversation
```
User: "Production is down. Need to fix this ASAP."
[User makes quick fix]
User: "That should work. Deploy it now."
```

### Analysis
- **Exclusion criteria:** Urgency keywords ("ASAP", "production down")
- **Time pressure present**

### Action
```
Assistant: [Help with deployment, do NOT suggest scan]
```

**Why:** User is in crisis mode. Suggesting scan would be tone-deaf and obstructive.

---

## ❌ Scenario 10: User Explicitly Declined (Do NOT Suggest)

### Context
User previously declined a scan suggestion and is continuing work.

### Conversation
```
Previous:
Assistant: "Would you like me to scan for quick wins?"
User: "No, not now."

Later:
User: "Done with the next feature. What's next?"
```

### Analysis
- **Exclusion criteria:** Recent decline (within same session)
- **User has expressed preference to skip**

### Action
```
Assistant: "Would you like to start on [next task]?"
[Do NOT suggest scan again - user already declined]
```

**Why:** Respect user's earlier decision. Don't be pushy.

---

## ⚠️ Scenario 11: Ambiguous Signal (Exercise Caution)

### Context
User says work is "done for now" but doesn't indicate commit intent.

### Conversation
```
User: "Done for now. Need to take a break."
```

### Analysis
- **Ambiguous:** Could mean taking a break, or work is complete
- **No clear commit intent**
- **When uncertain:** Skip

### Action
```
Assistant: "Sounds good. Let me know when you're back."
[Do NOT suggest scan - unclear if work is truly complete]
```

**Why:** Better to miss a suggestion than interrupt incorrectly. "When uncertain, skip."

---

## ✅ Scenario 12: User Returns After Break

### Context
User returns after a break and asks to review what was done.

### Conversation
```
User: [previously made changes, took break]
User: "Back. Let me review what I did."
[User reads modified files]
User: "Looks good. Ready to commit."
```

### Analysis
- **Strong signal:** "Ready to commit"
- **User reviewed changes**
- **Clear completion point**

### Action
```
Assistant: "Before committing, should I check the modified files for quick wins?"
```

---

## ✅ Scenario 13: Feature Branch Complete

### Context
User finished work on a feature branch and is preparing to create a PR.

### Conversation
```
User: "Feature is done. Time to create a PR."
```

### Analysis
- **Strong signals:** "Feature is done", PR creation
- **Natural checkpoint before PR**

### Action
```
Assistant: "Before creating the PR, would you like me to scan the changes for quick wins?"
```

---

## ❌ Scenario 14: Exploring Codebase (Do NOT Suggest)

### Context
User is reading code to understand how something works.

### Conversation
```
User: "Show me the authentication flow"
[User reads multiple files]
User: "How does the token refresh work?"
```

### Analysis
- **Exclusion criteria:** No code modifications
- **User is learning/exploring, not developing**

### Action
```
Assistant: [Explain the authentication flow]
[Do NOT suggest scan - no changes made]
```

**Why:** User is reading, not writing code.

---

## ✅ Scenario 15: Substantial Refactoring Complete

### Context
User completed a large refactoring effort across multiple files.

### Conversation
```
User: [refactors 8 files over several turns]
User: "Refactoring is done. Build passes."
```

### Analysis
- **Strong signal:** "done", "Build passes"
- **Moderate signals:** Substantial changes (8 files), build verification
- **High-value scan opportunity**

### Action
```
Assistant: "Great work! Would you like me to scan the refactored files for quick wins? I see you modified 8 files in the refactoring."
```

---

## Decision Summary Table

| Scenario | Completion Signal | Exclusions | Action |
|----------|------------------|------------|---------|
| 1. Natural completion | ✅ Strong | ❌ None | ✅ Suggest |
| 2. "What's next?" | ✅ Strong | ❌ None | ✅ Suggest |
| 3. Pre-commit | ✅ Strong | ❌ None | ✅ Suggest |
| 4. Tests passing | ✅ Strong | ❌ None | ✅ Suggest |
| 5. Multiple moderate | ✅ Moderate (3) | ❌ None | ✅ Suggest |
| 6. Mid-development | ❌ None | ✅ Active debugging | ❌ Skip |
| 7. Small change | ❌ None | ✅ Trivial edit | ❌ Skip |
| 8. Documentation only | ❌ None | ✅ No code changes | ❌ Skip |
| 9. Urgency | ❌ None | ✅ Time pressure | ❌ Skip |
| 10. User declined | ❌ None | ✅ Recent decline | ❌ Skip |
| 11. Ambiguous | ⚠️ Unclear | ⚠️ Uncertain | ❌ Skip (when uncertain) |
| 12. After review | ✅ Strong | ❌ None | ✅ Suggest |
| 13. PR preparation | ✅ Strong | ❌ None | ✅ Suggest |
| 14. Exploring | ❌ None | ✅ No modifications | ❌ Skip |
| 15. Major refactoring | ✅ Strong + Moderate | ❌ None | ✅ Suggest |

## Key Takeaways

1. **Strong signals (1+) or moderate signals (2+) trigger suggestions**
2. **Any exclusion criteria → always skip**
3. **When uncertain → skip** (better to miss than interrupt)
4. **Respect user preferences** (if they decline once, don't push)
5. **Context matters** (same words can mean different things in different situations)
