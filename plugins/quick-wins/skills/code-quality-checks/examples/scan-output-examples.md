# Quick Win Scan Output Examples

Real-world examples of quick win scan results and how to present them.

## Example 1: TypeScript Service Scan

### Scan Command
```
/quick-wins src/services/user.service.ts
```

### Output

```
Quick wins identified in user.service.ts:

Code Cleanup (Priority 1):
- 3 unused imports (BehaviorSubject, Subject, HttpHeaders)
- 2 console.log statements (lines 45, 78)
- 1 debugger statement (line 102)

Error Handling (Priority 1):
- 2 missing try-catch blocks (async operations at lines 34, 89)

Type Safety (Priority 2):
- 4 'any' types (lines 12, 23, 56, 78)
- 2 missing return types (functions at lines 45, 67)

Modern Syntax (Priority 2):
- 3 var declarations (lines 15, 23, 45)
- 5 string concatenations (lines 34, 56, 78, 90, 123)

Estimated time: 6 minutes
Impact: High - Improves type safety and removes debug code

Want me to fix these? (y/n)
```

---

## Example 2: Angular Component Scan

### Scan Command
```
/quick-wins src/app/components/user-list.component.ts
```

### Output

```
Quick wins identified in user-list.component.ts:

Code Cleanup (Priority 1):
- 2 unused imports (OnDestroy, Subscription)
- 1 console.log statement (line 34)

Error Handling (Priority 1):
- None found ✓

Angular Best Practices (Priority 2):
- Missing trackBy in *ngFor (template line 12)
- Manual subscription (should use async pipe, line 28)
- Missing OnPush change detection

Type Safety (Priority 2):
- 2 'any' types (lines 15, 34)

Estimated time: 4 minutes
Impact: Medium - Improves performance and reduces boilerplate

Want me to fix these? (y/n)
```

---

## Example 3: .NET API Controller Scan

### Scan Command
```
/quick-wins Controllers/UsersController.cs
```

### Output

```
Quick wins identified in UsersController.cs:

Code Cleanup (Priority 1):
- 3 unused using statements (System.Linq, System.Text, System.IO)
- 1 Console.WriteLine (line 67)

Error Handling (Priority 1):
- 3 async calls using .Result (blocking, lines 45, 67, 89)
- 2 missing null checks (parameters at lines 34, 78)

Type Safety (Priority 2):
- 5 'object' return types (should be specific DTOs)

Modern Syntax (Priority 2):
- 8 string.Format calls (lines 23, 45, 56, 67, 78, 89, 101, 123)
- 4 verbose null checks (lines 34, 56, 78, 90)

Estimated time: 7 minutes
Impact: High - Fixes blocking operations and improves type safety

Want me to fix these? (y/n)
```

---

## Example 4: Directory Scan

### Scan Command
```
/quick-wins src/app/services/
```

### Output

```
Quick wins identified in src/app/services/ (5 files scanned):

Code Cleanup (Priority 1):
- 12 unused imports across 5 files
- 7 console.log statements
- 1 debugger statement

Error Handling (Priority 1):
- 8 missing try-catch blocks for async operations

Type Safety (Priority 2):
- 15 'any' types across 5 files
- 6 missing return types

Modern Syntax (Priority 2):
- 10 var declarations
- 18 string concatenations

Top 3 files by issue count:
1. user.service.ts (8 issues)
2. auth.service.ts (6 issues)
3. data.service.ts (5 issues)

Estimated time: 25 minutes total (5 min per file average)
Impact: High - Significant codebase quality improvement

Fix all at once or one file at a time? (all/one/cancel)
```

---

## Example 5: Minimal Issues Found

### Scan Command
```
/quick-wins src/utils/helpers.ts
```

### Output

```
Quick wins identified in helpers.ts:

Code Cleanup (Priority 1):
- 1 unused import (Observable)

Modern Syntax (Priority 2):
- 2 string concatenations (lines 45, 67)

Estimated time: 1 minute
Impact: Low - Minor cleanup

Want me to fix these? (y/n)
```

---

## Example 6: No Issues Found

### Scan Command
```
/quick-wins src/models/user.model.ts
```

### Output

```
✨ No quick wins found in user.model.ts

Code quality looks good! ✓
- No unused imports
- No debug code
- Proper error handling
- Good type safety
- Modern syntax
```

---

## Example 7: After Task Completion (Stop Hook)

### Context
User just finished implementing a new feature

### Output

```
🎉 Feature implementation complete!

I noticed a few quick wins in the files you just modified:

Recent changes (3 files):
- user.component.ts: 4 quick wins (3 min)
- user.service.ts: 6 quick wins (4 min)
- user.model.ts: ✓ No issues

Quick wins available:

Code Cleanup:
- 2 console.log statements (debugging code)
- 3 unused imports

Type Safety:
- 4 'any' types added during implementation

Estimated time: 5 minutes
Impact: High - Clean up before committing

Want me to fix these before you commit? (y/n/later)
```

---

## Example 8: Progressive Disclosure

### Initial Scan
```
Quick wins identified (high-level summary):

Priority 1 (must fix): 8 issues
Priority 2 (should fix): 15 issues
Priority 3 (nice to have): 3 issues

Estimated time: 12 minutes total

Show detailed breakdown? (y/n)
```

### After User Confirms
```
Detailed breakdown:

Priority 1 - Must Fix (4 min):
✓ Code Cleanup
  - 4 console.log statements
  - 2 unused imports
  - 1 debugger statement
✓ Error Handling
  - 1 missing try-catch (API call)

Priority 2 - Should Fix (7 min):
✓ Type Safety
  - 8 'any' types
  - 3 missing return types
✓ Modern Syntax
  - 4 var declarations

Priority 3 - Nice to Have (1 min):
✓ Performance
  - 3 missing trackBy functions

Fix which priority level? (1/2/3/all/custom)
```

---

## Example 9: With User Preferences Applied

### Context
User has configured settings to skip certain checks

### Output

```
Quick wins identified in auth.service.ts:
(Skipping: string concatenation checks per your settings)

Code Cleanup (Priority 1):
- 2 console.log statements (lines 34, 67)

Error Handling (Priority 1):
- 1 missing try-catch (line 45)

Type Safety (Priority 2):
- 3 'any' types (lines 23, 45, 78)

Estimated time: 3 minutes
Impact: Medium

Want me to fix these? (y/n)
```

---

## Example 10: Interactive Fix Session

### After User Confirms Fix

```
Fixing quick wins in user.service.ts...

✅ Removed 3 unused imports (BehaviorSubject, Subject, HttpHeaders)
✅ Removed 2 console.log statements
✅ Removed 1 debugger statement
✅ Added try-catch to async operations (2 locations)
✅ Replaced 4 'any' types with proper interfaces
✅ Added 2 missing return types
✅ Converted 3 var to const
✅ Replaced 5 string concatenations with template literals

All fixes applied! ✓

Summary:
- 21 improvements made
- 0 breaking changes
- Time taken: 6 minutes
- File saved: user.service.ts

Recommendation: Run tests to verify changes
Next: Run /quick-wins on another file or commit these changes
```

---

## Format Guidelines

### Brief Format (Default)
- Category grouping
- Item counts
- File locations (if multiple files)
- Estimated time
- Impact level
- Simple yes/no question

### Detailed Format (On Request)
- Line numbers for each issue
- Specific code snippets
- Before/after previews
- Detailed explanations

### Summary Format (Multiple Files)
- Aggregated counts
- Top files by issue count
- Overall time estimate
- Priority breakdown

### Interactive Format
- Progressive disclosure
- User choices at each step
- Real-time feedback
- Status updates during fixes

---

Use these formats to communicate effectively with users about code quality improvements.
