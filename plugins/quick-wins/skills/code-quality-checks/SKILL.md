---
name: Code Quality Checks
description: This skill should be used when the user asks to "check code quality", "find code issues", "scan for problems", "identify improvements", "review code", or when analyzing code for quick wins. Defines what constitutes a "quick win" and how to identify high-impact, low-effort improvements.
version: 0.1.0
---

# Code Quality Checks

## Purpose

Define and identify "quick wins" - code improvements that take 1-5 minutes but provide significant value. Focus on automated detection of common issues that reduce quality, readability, or maintainability.

## Quick Win Definition

A **quick win** meets ALL these criteria:

1. **Low effort**: Takes 1-5 minutes to fix
2. **High impact**: Improves readability, maintainability, or performance
3. **Low risk**: Safe to apply without extensive testing
4. **Objective**: Clear improvement, not stylistic preference

## Quick Win Categories

### 1. Code Cleanup (Highest Priority)

**Unused Imports**
- Imports never referenced in file
- Detection: Scan import statements, check usage
- Safety: Always safe if tests pass
- Impact: Reduces clutter, faster builds

**Unused Variables**
- Variables declared but never used
- Detection: Check variable declarations and references
- Safety: Always safe
- Impact: Clearer code, fewer distractions

**Debug Code**
- `console.log` / `Console.WriteLine` statements
- `debugger` statements
- Commented code blocks
- Alert/print debugging
- Detection: Grep for debug patterns
- Safety: Always safe (shouldn't be in production)
- Impact: Cleaner production code

**Commented Code**
- Large blocks of commented-out code
- Detection: Multiple consecutive comment lines with code syntax
- Safety: Verify not documentation before removing
- Impact: Reduces confusion

### 2. Error Handling (High Priority)

**Missing Try-Catch**
- Async operations without error handling
- API calls without catch
- File operations without error handling
- Detection: Look for await/async without try-catch
- Safety: Always safe to add
- Impact: Prevents runtime crashes

**Generic Catch Blocks**
- catch(Exception) or catch(error) with no context
- Detection: Catch blocks without error logging or specific handling
- Safety: Safe to improve with specific types
- Impact: Better debugging, proper error handling

**Unhandled Promise Rejections**
- Promises without .catch() or try-catch
- Detection: Promise chains without error handling
- Safety: Always safe to add
- Impact: Prevents silent failures

**Missing Input Validation**
- Functions accepting inputs without validation
- Public APIs without parameter checks
- Detection: Function parameters used without null/type checks
- Safety: Safe to add at function boundaries
- Impact: Prevents runtime errors

### 3. Modern Syntax Updates (Medium Priority)

**Outdated Variable Declarations**
- `var` instead of `const`/`let` (JS/TS)
- Mutable where immutable preferred
- Detection: Scan for `var` keyword
- Safety: Safe if variable not reassigned outside block
- Impact: Clearer intent, prevents bugs

**Old String Formatting**
- String concatenation
- String.Format (when interpolation available)
- Detection: '+' operator with strings, String.Format calls
- Safety: Always safe
- Impact: More readable

**Old Function Syntax**
- Function expressions instead of arrow functions
- Anonymous functions
- Detection: `function()` keyword in callbacks
- Safety: Safe except when `this` binding matters
- Impact: More concise, modern

**Outdated Null Checks**
- `if (x !== null && x !== undefined)`
- Verbose null checking
- Detection: Explicit null and undefined checks
- Safety: Always safe with modern operators
- Impact: More concise

### 4. Type Safety (Medium Priority)

**Any Types**
- TypeScript `any` types
- Detection: Scan for `: any` type annotations
- Safety: Safe to add proper types
- Impact: Better IDE support, catches bugs

**Missing Types**
- Function parameters without types
- Return types not specified
- Detection: Functions without type annotations
- Safety: Safe to add
- Impact: Type safety, documentation

**Implicit Any**
- Variables with no type and no initializer
- Detection: Variables without type annotation or value
- Safety: Safe to add explicit type
- Impact: Prevents type errors

### 5. Performance Quick Wins (Lower Priority)

**Missing Memoization**
- Expensive pure functions without caching
- Repeated calculations
- Detection: Pure functions called multiple times
- Safety: Verify function is pure
- Impact: Faster execution

**Unnecessary Re-renders**
- React/Angular components re-rendering unnecessarily
- Missing trackBy (Angular)
- Missing React.memo
- Detection: *ngFor without trackBy, components without memo
- Safety: Safe to add
- Impact: Better performance

**Synchronous When Could Be Parallel**
- Sequential await calls that could run in parallel
- Detection: Multiple awaits that don't depend on each other
- Safety: Verify no dependencies between operations
- Impact: Faster execution

## Detection Strategies

### Automated Scans

**Import Analysis**
```
1. Parse all import statements
2. Check if each import is used in file
3. Identify unused imports
4. Present list with file locations
```

**Debug Code Detection**
```
1. Grep for console.log, Console.WriteLine
2. Grep for debugger statements
3. Grep for alert, print debugging
4. List all occurrences with line numbers
```

**Type Analysis**
```
1. Find `: any` type annotations
2. Find untyped function parameters
3. Find functions without return types
4. Present prioritized list
```

**Error Handling Scan**
```
1. Find async/await without try-catch
2. Find Promise chains without .catch()
3. Find API calls without error handling
4. Present with risk assessment
```

### Manual Review

**Code Duplication**
```
1. Look for repeated code blocks (3+ lines, 3+ occurrences)
2. Identify similar patterns with slight variations
3. Assess extraction opportunity
4. Estimate effort vs benefit
```

**Complex Logic**
```
1. Identify deeply nested conditions
2. Look for long functions (>50 lines)
3. Find functions doing multiple things
4. Assess simplification opportunities
```

## Prioritization Matrix

### Priority 1: Must Fix (1-2 min)
- Console.log in production code
- Unused imports causing build warnings
- Missing error handling for critical operations
- Debug code (debugger, alerts)

### Priority 2: Should Fix (3-5 min)
- Unused variables
- Type safety issues (any types)
- Missing input validation
- Outdated syntax with modern alternatives

### Priority 3: Nice to Fix (5-10 min)
- Code duplication (if simple extraction)
- Performance improvements (if measurable)
- Complex logic (if straightforward simplification)

### Skip for Now (>10 min or risky)
- Architecture changes
- Complex refactoring
- Breaking changes
- Requires extensive testing

## Output Format

Present findings as brief, scannable lists:

```
Quick wins identified:

Code Cleanup (Priority 1):
- 5 unused imports (file1.ts, file2.ts, file3.ts)
- 3 console.log statements (debug.ts:45, service.ts:78, utils.ts:12)

Error Handling (Priority 1):
- 2 missing try-catch blocks (API calls in service.ts:34, service.ts:89)

Type Safety (Priority 2):
- 4 'any' types (component.ts:12, service.ts:45, util.ts:23, model.ts:8)

Modern Syntax (Priority 2):
- 6 var declarations (legacy.ts:15, 23, 45, helper.ts:12, 34, 56)

Estimated total time: 8 minutes
Want me to fix these?
```

## Language-Specific Checks

### TypeScript/JavaScript

**High Priority:**
- Unused imports/exports
- console.log/debugger statements
- Missing error handling on async/await
- `any` types
- Unhandled promise rejections

**Medium Priority:**
- `var` → `const`/`let`
- Function expressions → Arrow functions
- String concatenation → Template literals
- Old null checks → Optional chaining

### Angular

**High Priority:**
- Missing trackBy in *ngFor
- Manual subscriptions (should use async pipe)
- `any` types in services/components
- Missing error handling in HTTP calls

**Medium Priority:**
- Missing OnPush change detection
- Non-standalone components (Angular 14+)
- Old RxJS import patterns
- Missing providedIn: 'root'

### .NET/C#

**High Priority:**
- Unused using statements
- Console.WriteLine in non-debug code
- Missing null checks
- Blocking .Result on async calls

**Medium Priority:**
- String.Format → String interpolation
- Verbose null checks → Null-coalescing
- Traditional loops → LINQ
- Missing async/await

## Integration with Quick-Wins Plugin

This skill supports:

1. **Quick-Win-Finder Agent**: Uses these checks to scan code
2. **/quick-wins Command**: Applies these checks on-demand
3. **Stop Hook**: Suggests relevant checks after task completion

## Exclusion Patterns

**Don't Flag These:**
- **Private/protected fields with underscore prefix** (`_myField`, `_service`) - FlowAccount convention
- console.log in test files (`.spec.ts`, `.test.ts`, `.test.js`)
- console.log in development utilities
- Commented code with "TODO", "NOTE", "FIXME"
- Third-party library patterns
- Generated code (files with `// Generated` or `@generated` comments)
- Nx workspace files (`workspace.json`, `nx.json`, `project.json`)
- Files in `node_modules/`, `dist/`, `coverage/`

**FlowAccount-Specific Exclusions:**
- Don't suggest removing interface implementations (required by FlowAccount standard)
- Don't suggest removing async/await (required for all I/O operations)
- Don't suggest changing `flowaccount` component prefix (required)
- Don't suggest violating Nx project boundaries
- Don't flag constructor injection patterns

**Configurable via Settings:**
- File patterns to exclude
- Specific check types to disable
- Custom patterns to ignore

## Assessment Process

For each potential quick win:

1. **Identify**: Find the issue pattern
2. **Verify**: Confirm it's actually a problem
3. **Estimate**: Calculate fix time (must be 1-5 min)
4. **Assess Impact**: Determine benefit level
5. **Check Safety**: Ensure low risk
6. **Prioritize**: Assign to priority bucket

Only present issues that pass all criteria.

## Best Practices

**Scanning:**
- Start with highest priority checks
- Scan recently modified files first
- Group similar issues together
- Present brief summaries, not exhaustive details

**Communication:**
- Use concrete numbers ("5 unused imports" not "several imports")
- Include file locations
- Group by category
- Estimate total time
- Always ask before applying fixes

**Application:**
- Fix one category at a time
- Apply safest fixes first
- Run tests between categories
- Report completion status

**Quality:**
- Ensure scans are accurate (no false positives)
- Verify fixes don't break functionality
- Maintain consistent code style
- Respect team conventions

## Additional Resources

### Reference Files

For detailed check implementations:
- **`references/typescript-checks.md`** - TypeScript-specific checks
- **`references/angular-checks.md`** - Angular framework checks
- **`references/dotnet-checks.md`** - .NET/C# checks

### Example Files

Example scan outputs:
- **`examples/scan-output-examples.md`** - Real scan results

---

Use these checks systematically to maintain high code quality through continuous small improvements.
