---
description: Apply a specific quick win improvement
argument-hint: [description or location]
allowed-tools: Read, Write, Edit, Grep
model: inherit
---

Apply the specified quick win improvement with confirmation.

**Target:** $ARGUMENTS

**Process:**

1. **Identify the improvement:**
   - Parse description: $ARGUMENTS
   - Locate exact code to change
   - Read current code using Read tool

2. **Plan the fix:**
   - Determine change type (cleanup, error handling, type fix, syntax update)
   - Use refactoring-patterns skill to validate approach
   - Ensure change is safe (no behavior modifications)
   - Estimate effort (must be 1-5 minutes)

3. **Show preview:**
   ```
   Location: [file]:[line]
   Current code:
   [show current code]

   Proposed change:
   [show new code]

   Type: [cleanup/error-handling/type-safety/syntax]
   Risk: Low/Medium
   Estimated time: X minutes
   ```

4. **Get confirmation:**
   - Ask: "Apply this change? (y/n)"
   - If yes: Apply using Edit tool
   - If no: Cancel and explain how to modify

5. **Apply and verify:**
   - Make the change using Edit tool
   - Report completion
   - Suggest running tests if significant change

**Valid Quick Win Types:**

**Code Cleanup:**
- Remove unused import: "Remove unused import X from file.ts"
- Remove console.log: "Remove console.log from file.ts:45"
- Delete commented code: "Remove commented code block in file.ts:100-120"

**Error Handling:**
- Add try-catch: "Add error handling to async function in file.ts:34"
- Add null check: "Add null check for parameter in file.ts:56"
- Handle promise: "Add .catch() to promise chain in file.ts:78"

**Type Safety:**
- Fix any type: "Replace 'any' with proper type in file.ts:12"
- Add return type: "Add return type to function in file.ts:45"
- Add parameter type: "Add type annotation to parameter in file.ts:67"

**Modern Syntax:**
- Update var: "Convert var to const in file.ts:23"
- String interpolation: "Replace string concatenation with template literal in file.ts:34"
- Arrow function: "Convert function expression to arrow function in file.ts:56"

**Examples:**

```
/apply-win Remove unused import Observable from user.service.ts
/apply-win Add error handling to API call at line 45 in data.service.ts
/apply-win Replace 'any' type with User interface in component.ts:12
/apply-win Convert var to const in utils.ts:23
```

**Safety Checks:**
- ✅ Verify change is reversible
- ✅ Ensure no functional changes
- ✅ Maintain code style
- ✅ Preserve comments and formatting
- ✅ Don't modify generated code
- ✅ Respect existing patterns

**After applying:**
- Report success
- Show what changed
- Suggest related improvements if any
- Recommend running tests

If description is ambiguous, ask clarifying questions before proceeding.
