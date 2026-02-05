---
name: codebase-scout
description: |
  Skill for quickly locating where a feature should be implemented and identifying existing patterns to follow.
  Use when you need to find target files, naming conventions, and similar implementations in the codebase.

  Triggers: "find where to implement", "locate feature", "find patterns", "scout codebase", "where does this go"
---

# Codebase Scout Skill

## Purpose

Quickly identify **where** a feature belongs and **how** it should be built based on existing patterns. Output a concise location brief that enables immediate implementation.

## Methodology

### Step 1: Understand the Feature
Parse the feature request to identify:
- **Domain**: What area? (auth, billing, settings, etc.)
- **Type**: Component, service, API endpoint, utility?
- **Touchpoints**: UI, backend, database?

### Step 2: Find Target Location
Search strategy (in order):
1. **Keyword search**: Grep for related terms in file names
2. **Directory scan**: Check obvious locations (`src/components/`, `src/services/`, etc.)
3. **Similar feature**: Find existing feature of same type

**Max files to report: 5** (focus on primary targets)

### Step 3: Identify Patterns
For each target file, note:
- Naming convention (PascalCase, kebab-case, etc.)
- File structure pattern (component + spec + style?)
- Import patterns (what gets imported?)
- Similar implementations to reference

### Step 4: Output Location Brief

```markdown
## Location Brief

### Primary Target
- **File**: `src/components/Settings/ThemeToggle.tsx`
- **Type**: React Component
- **Create/Modify**: Create new

### Related Files
1. `src/components/Settings/index.ts` - Add export
2. `src/services/theme.service.ts` - Existing theme logic

### Pattern to Follow
Reference: `src/components/Settings/LanguageToggle.tsx`
- Uses `useSettings` hook
- Follows `*Toggle` naming convention
- Has co-located test file `*.spec.tsx`

### Naming Convention
- Component: `PascalCase`
- File: `PascalCase.tsx`
- Test: `PascalCase.spec.tsx`
```

## Anti-Patterns

- **Don't**: List every possibly-related file (max 5)
- **Don't**: Deep-dive into implementation details
- **Don't**: Suggest refactoring existing code
- **Do**: Focus on enabling quick, confident implementation
