---
description: Scan code for quick wins - easy improvements that provide high impact
argument-hint: [file-or-directory]
allowed-tools: Read, Grep, Glob, Bash(git:*)
model: inherit
---

Scan for quick wins (1-5 minute improvements with high impact) in the specified code.

**Scope:**
$IF($1,
  Scan: $1,
  Scan recent changes: !`git diff --name-only HEAD~1` and currently modified files
)

**Analysis Categories:**
1. **Code Cleanup** (Priority 1)
   - Unused imports/variables
   - Debug code (console.log, debugger)
   - Commented code blocks

2. **Error Handling** (Priority 1)
   - Missing try-catch on async operations
   - Unhandled promise rejections
   - Missing input validation

3. **Type Safety** (Priority 2)
   - 'any' types (TypeScript)
   - Missing type annotations
   - Implicit types

4. **Modern Syntax** (Priority 2)
   - var → const/let
   - Old string formatting
   - Outdated patterns

5. **Performance** (Priority 3)
   - Missing trackBy (Angular)
   - Unnecessary re-renders
   - Sequential operations that could be parallel

**Output Format:**
Present findings as brief, scannable list:

```
Quick wins identified in [scope]:

Code Cleanup (Priority 1):
- X unused imports (file1.ts, file2.ts)
- Y console.log statements (file1.ts:45, file2.ts:78)

Error Handling (Priority 1):
- X missing try-catch blocks (API calls in service.ts:34)

Type Safety (Priority 2):
- X 'any' types (component.ts:12, service.ts:45)

Modern Syntax (Priority 2):
- X var declarations (legacy.ts:15, 23, 45)

Estimated time: X minutes
Impact: High/Medium/Low

Want me to fix these? (y/n)
```

**Process:**
1. Use Glob/Grep to scan for patterns
2. Use refactoring-patterns skill to validate safety
3. Use code-quality-checks skill to assess impact
4. Group by priority and category
5. Estimate total time (1-5 min per item)
6. Ask for confirmation before applying fixes

**Technology Stack:**
- TypeScript/JavaScript: Check imports, console.log, var, any types
- Angular: Check trackBy, async pipe, OnPush, manual subscriptions
- .NET/C#: Check using statements, Console.WriteLine, .Result, null checks

**Safety:**
- Only suggest changes that are objectively improvements
- Avoid style preferences
- Respect existing patterns if intentional
- Don't suggest changes to generated code or third-party libraries

If user confirms, apply fixes one category at a time, reporting progress.
