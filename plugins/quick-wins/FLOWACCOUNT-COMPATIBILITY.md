# FlowAccount Workspace Compatibility

This document ensures the quick-wins plugin is fully compatible with FlowAccount's two main workspaces.

## ✅ Compatibility Status: FULLY COMPATIBLE

The quick-wins plugin has been configured to work seamlessly with both FlowAccount workspaces:

1. **flowaccount.workspace** (TypeScript/Angular)
2. **flowaccount.dotnet.workspace** (.NET/C#)

---

## 🎯 Technology Stack Support

| Technology | flowaccount.workspace | flowaccount.dotnet.workspace | quick-wins Support |
|------------|----------------------|------------------------------|-------------------|
| TypeScript | ✅ Primary | ❌ Not used | ✅ Full support |
| Angular 17 | ✅ Primary | ❌ Not used | ✅ Full support |
| .NET/C# | ❌ Not used | ✅ .NET 7-9 | ✅ Full support |
| Nx Monorepo | ✅ Yes | ✅ Yes | ✅ Respects boundaries |

---

## 🔧 FlowAccount-Specific Configurations

### 1. Naming Conventions (Both Workspaces)

**Underscore Prefix for Private/Protected Fields**
- ✅ **Respected**: Plugin does NOT flag `_myField`, `_service` as issues
- This is FlowAccount standard across both workspaces
- Configured in: `skills/code-quality-checks/SKILL.md`

**Descriptive Names (No Abbreviations)**
- ✅ **Enforced**: Plugin suggests full descriptive names
- ❌ Flags: `custSvc` → suggests `customerService`
- Aligns with both workspace standards

### 2. .NET Clean Architecture (.NET Workspace)

**Strict Layering Rules**
```
Controller → Facade → Logic → Service → DataHandler
```

**Plugin Behavior:**
- ✅ Does NOT suggest bypassing layers
- ✅ Respects that only Services call DataHandler
- ✅ Won't suggest Controllers calling DataHandler directly
- Configured in: `skills/refactoring-patterns/references/dotnet-patterns.md`

**Interface Requirements:**
- ✅ Does NOT suggest removing interfaces
- All classes MUST implement interfaces (FlowAccount rule)
- Plugin respects this pattern

**Dependency Injection:**
- ✅ Does NOT suggest static services
- Constructor injection is mandatory
- Plugin aligns with this pattern

### 3. Angular/Nx Boundaries (TypeScript Workspace)

**Domain-Driven Design (DDD) Rules:**
- Apps only import: features, shared, core
- UI apps only import `type:ui` libs
- API apps only import `type:api` libs
- No cross-domain dependencies

**Plugin Behavior:**
- ✅ Does NOT suggest cross-domain imports
- ✅ Respects Nx project boundaries
- ✅ Won't suggest violating DDD rules
- Configured in: `skills/refactoring-patterns/references/typescript-patterns.md`

**Component Prefix:**
- ✅ Does NOT suggest removing `flowaccount` prefix
- This is workspace standard
- Plugin respects this convention

### 4. Testing Frameworks

**TypeScript Workspace:**
- Jest for unit tests ✅
- Cypress/Playwright for E2E ✅

**C# Workspace:**
- xUnit for unit tests ✅
- Playwright API for E2E ✅

**Plugin Behavior:**
- ✅ Respects existing test frameworks
- ✅ Does NOT suggest switching test libraries
- ✅ Suggests test improvements within current frameworks

---

## 🚫 What Plugin Will NOT Flag

### Global Exclusions (Both Workspaces)

1. **Naming Patterns:**
   - ❌ `_underscore` prefix for private/protected fields
   - ❌ `flowaccount` component prefix

2. **Architecture Patterns:**
   - ❌ Interface implementations (required)
   - ❌ Constructor injection patterns
   - ❌ Async/await patterns (required for I/O)

3. **File Types:**
   - ❌ Test files: `*.spec.ts`, `*.test.ts`, `*.Test.csproj`
   - ❌ Generated code
   - ❌ Third-party libraries
   - ❌ Nx workspace files: `workspace.json`, `nx.json`, `project.json`

4. **Development Code:**
   - ❌ console.log in test files
   - ❌ console.log in dev utilities
   - ❌ TODO/NOTE/FIXME comments

### Workspace-Specific Exclusions

**TypeScript Workspace:**
- ❌ Nx boundary violations (already enforced by Nx)
- ❌ Domain-driven design violations
- ❌ Component prefix patterns

**.NET Workspace:**
- ❌ Clean Architecture layer violations
- ❌ Repository pattern implementations
- ❌ Akka.NET actor patterns

---

## ✨ What Plugin WILL Suggest

### TypeScript/Angular Quick Wins

1. **Code Cleanup:**
   - Remove unused imports (except intentional)
   - Remove debug console.log (except in tests/utils)
   - Remove debugger statements

2. **Error Handling:**
   - Add try-catch to async operations
   - Handle promise rejections
   - Add input validation

3. **Type Safety:**
   - Replace `any` with proper types
   - Add missing type annotations
   - Add return types to functions

4. **Modern Angular:**
   - Add trackBy to *ngFor
   - Use async pipe instead of manual subscriptions
   - Add OnPush change detection
   - Convert to standalone components (Angular 14+)

5. **Modern Syntax:**
   - var → const/let
   - String concatenation → template literals
   - Function expressions → arrow functions
   - Old null checks → optional chaining

### C#/.NET Quick Wins

1. **Code Cleanup:**
   - Remove unused using statements
   - Remove Console.WriteLine (except in tests)
   - Remove debug code

2. **Error Handling:**
   - Add try-catch to async operations
   - Add null checks (defensive programming)
   - Proper exception handling

3. **Modern C#:**
   - String.Format → string interpolation
   - Verbose null checks → null-coalescing operators (`??`, `?.`)
   - Traditional loops → LINQ
   - var when type is obvious

4. **Async Patterns:**
   - Blocking .Result → async/await
   - Sequential operations → parallel (Task.WhenAll)
   - Add ConfigureAwait(false) in library code

---

## 🔌 MCP Agent Compatibility (.NET Workspace)

The .NET workspace has multiple MCP agents:
- software-engineer
- architect
- unit-tester
- integration-tester
- requirements-analyst
- infrastructure-engineer
- security-scanner

**Plugin Behavior:**
- ✅ Works alongside MCP agents without conflict
- ✅ Stop hook does NOT interfere with MCP agent workflows
- ✅ Plugin suggestions complement security-scanner findings
- ✅ Can be used before/after MCP agent work

**Recommended Workflow:**
```
1. Use MCP agent to implement feature
2. Quick-wins plugin scans and suggests improvements
3. Apply quick wins
4. Use security-scanner agent for final security check
```

---

## 🎨 Hook Configuration

### Stop Hook Behavior

**When it triggers:**
- ✅ After completing a feature
- ✅ After significant code changes
- ✅ When user says "I'm done"

**When it SKIPS:**
- ❌ Urgent bug fixes (user mentions "urgent", "critical", "hotfix")
- ❌ Documentation-only changes
- ❌ Trivial changes (typo fixes, single-line changes)
- ❌ When user explicitly says "skip scan" or "don't check"

**Smart Context Awareness:**
- Respects both workspace contexts
- Understands FlowAccount patterns
- Non-blocking (can be ignored)

---

## 📝 Recommended Usage Patterns

### For TypeScript/Angular Workspace

```bash
# After implementing a feature
[Complete Angular component]
# Quick-wins automatically scans
# Review and apply suggestions

# Manual scanning
/quick-wins apps/frontend/flowaccount-ui/src/app/features/
/quick-wins libs/domain/accounting-domain/ui/

# Before committing
/quick-wins  # Scan recent changes
git add . && git commit
```

### For .NET Workspace

```bash
# After implementing a feature
[Complete C# service following Clean Architecture]
# Quick-wins automatically scans
# Review and apply suggestions

# Manual scanning
/quick-wins apps/FlowAccount.Business.API/
/quick-wins libs/Core.Domain/

# Before committing
/quick-wins  # Scan recent changes
git add . && git commit
```

---

## 🚀 Integration with Existing Workflows

### TypeScript Workspace Integration

**Before Creating PR:**
```
1. Implement feature following DDD
2. Run affected tests: yarn nx affected:test
3. Quick-wins scan: /quick-wins
4. Apply suggestions
5. Run tests again
6. Create PR
7. GitHub Actions security scan runs
```

**Works with:**
- ✅ Jenkins CI/CD pipeline
- ✅ Nx affected commands
- ✅ GitHub Actions security scanning (Semgrep)
- ✅ Existing linting (ESLint, Prettier)

### .NET Workspace Integration

**Before Creating PR:**
```
1. Implement feature following Clean Architecture
2. Run tests: dotnet test
3. Quick-wins scan: /quick-wins
4. Apply suggestions
5. Run tests again
6. Security scan: Use security-scanner agent
7. Create PR
```

**Works with:**
- ✅ Existing unit test patterns (xUnit, Moq)
- ✅ Playwright E2E tests
- ✅ SonarCloud analysis
- ✅ MCP agents workflow

---

## ⚙️ Optional: Workspace-Specific Settings

### TypeScript Workspace Settings

Create `.claude/quick-wins.local.md` in flowaccount.workspace:

```yaml
---
# TypeScript/Angular specific settings
enabled_checks:
  - code_cleanup
  - error_handling
  - type_safety
  - modern_syntax

exclude_patterns:
  - "*.spec.ts"
  - "*.e2e-spec.ts"
  - "apps/**/environments/**"
  - "libs/shared/**/*.stories.ts"
  - "**/node_modules/**"
  - "**/dist/**"
  - "**/coverage/**"

# Respect Nx boundaries
respect_nx_boundaries: true

# Don't suggest removing flowaccount prefix
preserve_component_prefix: "flowaccount"

min_impact: medium
auto_fix: false
---

# FlowAccount TypeScript Workspace

Additional notes:
- Respect DDD boundaries
- OnPush change detection preferred
- async pipe over manual subscriptions
```

### .NET Workspace Settings

Create `.claude/quick-wins.local.md` in flowaccount.dotnet.workspace:

```yaml
---
# .NET/C# specific settings
enabled_checks:
  - code_cleanup
  - error_handling
  - modern_syntax

exclude_patterns:
  - "*.Test.csproj"
  - "**/*.Test/**"
  - "**/bin/**"
  - "**/obj/**"
  - "**/Migrations/**"

# Respect Clean Architecture
respect_clean_architecture: true

# Preserve underscore prefix
preserve_underscore_prefix: true

min_impact: medium
auto_fix: false
---

# FlowAccount .NET Workspace

Additional notes:
- Respect Clean Architecture layers
- All classes must implement interfaces
- Constructor injection only
- Async/await for all I/O operations
```

---

## ✅ Validation Checklist

Before using in FlowAccount workspaces:

**TypeScript Workspace:**
- [ ] Plugin respects `_underscore` prefix
- [ ] Plugin respects `flowaccount` component prefix
- [ ] Plugin doesn't suggest violating Nx boundaries
- [ ] Plugin suggests OnPush change detection
- [ ] Plugin suggests async pipe over subscriptions
- [ ] Plugin doesn't flag Jest/Cypress patterns

**.NET Workspace:**
- [ ] Plugin respects `_underscore` prefix
- [ ] Plugin respects Clean Architecture layers
- [ ] Plugin doesn't suggest removing interfaces
- [ ] Plugin doesn't suggest static services
- [ ] Plugin suggests async/await properly
- [ ] Plugin doesn't flag xUnit test patterns

**Both Workspaces:**
- [ ] Stop hook doesn't block urgent fixes
- [ ] Stop hook respects context (no scan for docs-only)
- [ ] Manual commands work as expected
- [ ] Exclusion patterns work correctly

---

## 🐛 Troubleshooting

### Plugin Suggests Incorrect Changes

**Issue:** Plugin flags underscore prefix as issue
**Solution:** Check that `skills/code-quality-checks/SKILL.md` has exclusion pattern

**Issue:** Plugin suggests violating Clean Architecture
**Solution:** Check that `skills/refactoring-patterns/references/dotnet-patterns.md` has FlowAccount conventions

**Issue:** Plugin suggests removing flowaccount prefix
**Solution:** Check that `skills/refactoring-patterns/references/typescript-patterns.md` has FlowAccount conventions

### Stop Hook Too Aggressive

**Issue:** Hook triggers on trivial changes
**Solution:** The hook has smart detection - it should skip trivial changes. If not working, check `hooks/hooks.json` prompt logic.

**Issue:** Hook blocks urgent fixes
**Solution:** Mention "urgent", "hotfix", or "critical" - hook will skip scanning

---

## 📞 Support

If you encounter compatibility issues:

1. Check this document first
2. Review the exclusion patterns in skill files
3. Add workspace-specific exclusions to `.claude/quick-wins.local.md`
4. Report issues for plugin improvement

---

**Last Updated:** 2026-01-21
**Plugin Version:** 0.1.0
**Compatible with:** FlowAccount workspaces (both TypeScript and .NET)
