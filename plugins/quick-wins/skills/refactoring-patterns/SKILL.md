---
name: Refactoring Patterns
description: This skill should be used when the user asks to "refactor code", "improve code structure", "extract function", "simplify code", "remove duplication", "update syntax", or when identifying quick refactoring opportunities. Provides safe refactoring techniques for TypeScript, JavaScript, Angular, and .NET.
version: 0.1.0
---

# Refactoring Patterns

## Purpose

Provide safe, high-impact refactoring patterns that improve code quality with minimal effort. Focus on "quick wins" - refactorings that take 1-5 minutes but significantly improve readability, maintainability, or performance.

## When to Use This Skill

Use this skill when:
- Identifying code improvement opportunities
- Suggesting refactoring changes
- Applying safe transformations to existing code
- Modernizing legacy syntax
- Reducing code duplication
- Improving code clarity

## Core Refactoring Categories

### 1. Extract and Simplify

**Extract Function/Method**
- Identify code blocks that do one thing
- Extract to named function with clear purpose
- Benefits: Readability, testability, reusability

**Extract Variable**
- Replace complex expressions with named variables
- Clarify intent with descriptive names
- Benefits: Readability, debuggability

**Simplify Conditionals**
- Replace nested if/else with early returns
- Use guard clauses for validation
- Convert complex boolean logic to named functions
- Benefits: Reduced nesting, clearer flow

### 2. Remove Duplication

**Identify Patterns**
- Look for repeated code blocks (3+ occurrences)
- Similar logic with slight variations
- Copy-pasted code with minor differences

**Consolidation Strategies**
- Extract common logic to shared function
- Use parameters for variations
- Create utility functions for frequent operations
- Benefits: DRY principle, easier maintenance

### 3. Modern Syntax Updates

**TypeScript/JavaScript**
- `var` → `const`/`let`
- Function expressions → Arrow functions
- String concatenation → Template literals
- `obj.prop` → Optional chaining `obj?.prop`
- `if (x !== null && x !== undefined)` → `if (x != null)`
- Callbacks → Promises/async-await
- `Array.prototype` loops → Modern methods (map, filter, reduce)

**Angular**
- Old decorators → Current Angular patterns
- `any` types → Proper TypeScript types
- Manual subscriptions → `async` pipe
- Component lifecycle → OnPush change detection
- `HttpModule` → `HttpClient`

**.NET/C#**
- Old syntax → Modern C# features
- Explicit types → `var` where appropriate
- Traditional loops → LINQ
- Null checks → Null-coalescing operators (`??`, `?.`)
- String formatting → String interpolation

### 4. Error Handling Improvements

**Add Missing Error Handling**
- Wrap risky operations in try-catch
- Validate inputs before processing
- Handle async errors properly
- Provide meaningful error messages

**Improve Existing Error Handling**
- Replace generic catch blocks with specific error types
- Add context to error messages
- Log errors appropriately
- Clean up resources in finally blocks

### 5. Performance Quick Wins

**Memoization**
- Cache expensive calculations
- Use memoization for pure functions
- Implement simple caching strategies

**Lazy Loading**
- Defer loading of heavy resources
- Use dynamic imports
- Implement on-demand data fetching

**Unnecessary Re-renders (React/Angular)**
- Identify components re-rendering unnecessarily
- Add proper shouldComponentUpdate/trackBy
- Use React.memo/OnPush strategy

## Quick Win Identification Process

### Step 1: Scan for Low-Hanging Fruit

Quickly identify obvious improvements:
1. **Unused code**: Imports, variables, functions not referenced
2. **Debug code**: console.log, commented code, TODO comments
3. **Simple syntax updates**: Easy modernization opportunities
4. **Missing error handling**: Operations without try-catch
5. **Code duplication**: Identical or near-identical blocks

### Step 2: Assess Impact vs Effort

Prioritize by ROI:
- **High impact, low effort** (1-2 min): Top priority
  - Remove unused imports
  - Delete console.log statements
  - Fix obvious type issues

- **Medium impact, low effort** (3-5 min): Good wins
  - Extract repeated code
  - Add error handling
  - Simplify conditionals

- **High impact, medium effort** (5-10 min): Consider context
  - Major refactoring
  - Architecture changes
  - Performance optimizations

**For quick-wins plugin: Focus on 1-5 minute improvements only**

### Step 3: Present Brief Summary

Format: Brief, scannable list
```
Quick wins identified:
- 3 unused imports (utility.ts, service.ts, component.ts)
- 2 console.log statements (debug.ts line 45, service.ts line 78)
- 1 duplicated validation logic (3 occurrences)
- 2 missing error handlers (API calls in service.ts)

Estimated time: 4 minutes
Want me to fix these?
```

### Step 4: Apply with User Confirmation

Before applying changes:
1. Show what will be fixed
2. Get user confirmation
3. Apply changes file by file
4. Report completion

## Safety Guidelines

### Always Safe
- Remove unused imports/variables (if tests pass)
- Delete console.log/debugger statements
- Add missing error handling
- Extract pure functions
- Rename for clarity

### Verify First
- Removing commented code (might be intentional)
- Changing control flow (early returns, guard clauses)
- Performance optimizations (measure first)
- Type changes (ensure compatibility)

### Require Discussion
- Architecture changes
- Breaking API changes
- Complex refactorings affecting multiple files
- Changes to public interfaces

## Language-Specific Patterns

### TypeScript/JavaScript Quick Wins

**Unused Imports**
```typescript
// Before
import { UsedThing, UnusedThing } from './module';

// After
import { UsedThing } from './module';
```

**Modern Syntax**
```typescript
// Before
var items = data.map(function(item) {
  return item.name;
});

// After
const items = data.map(item => item.name);
```

**Optional Chaining**
```typescript
// Before
const value = obj && obj.prop && obj.prop.value;

// After
const value = obj?.prop?.value;
```

### Angular Quick Wins

**Async Pipe**
```typescript
// Before
data$: Observable<Data>;
ngOnInit() {
  this.data$.subscribe(data => this.data = data);
}

// After - use async pipe in template
// No subscription needed in component
```

**Proper Types**
```typescript
// Before
function process(data: any) { }

// After
function process(data: ProcessData) { }
```

### .NET/C# Quick Wins

**Null-Coalescing**
```csharp
// Before
string value = name != null ? name : "default";

// After
string value = name ?? "default";
```

**String Interpolation**
```csharp
// Before
string msg = "Hello, " + name + "!";

// After
string msg = $"Hello, {name}!";
```

**LINQ**
```csharp
// Before
var result = new List<int>();
foreach (var item in items) {
  if (item > 10) result.Add(item);
}

// After
var result = items.Where(x => x > 10).ToList();
```

## Integration with Quick-Wins Plugin

This skill supports the plugin workflow:

1. **Quick-Win-Finder Agent**: Uses patterns here to identify improvements
2. **/quick-wins Command**: Applies these patterns to scan code
3. **Stop Hook**: Suggests relevant refactorings after task completion

Reference this skill when:
- Identifying what constitutes a "quick win"
- Determining if a refactoring is safe to apply
- Estimating effort for improvements
- Prioritizing multiple potential improvements

## Additional Resources

### Reference Files

For detailed refactoring techniques:
- **`references/typescript-patterns.md`** - TypeScript-specific refactorings
- **`references/angular-patterns.md`** - Angular framework patterns
- **`references/dotnet-patterns.md`** - .NET/C# modernization

### Example Files

Working examples in `examples/`:
- **`before-after-examples.md`** - Real-world refactoring examples

## Best Practices

**Communication**
- Present findings as brief lists
- Estimate time clearly
- Get confirmation before applying
- Report completion status

**Execution**
- Apply changes incrementally
- Run tests between changes
- Commit refactorings separately
- Document what changed

**Quality**
- Ensure tests still pass
- Maintain behavior (no functional changes)
- Improve readability as primary goal
- Consider team conventions

**Scope Management**
- Stay focused on quick wins (1-5 min)
- Defer complex refactorings
- Suggest but don't over-engineer
- Respect user preferences

---

Apply these patterns systematically to maintain high code quality through continuous small improvements.
