# Pattern Types Reference

This reference documents every pattern type the observation system can detect, how observations are structured, what instincts each type generates, and concrete examples.

## Tool Preferences

### What It Detects

Consistent use of one tool over functionally equivalent alternatives for a specific task type.

### How Observations Are Structured

```json
{
  "timestamp": "2026-02-10T10:00:00",
  "tool": "Grep",
  "input_summary": {"pattern": "TODO", "path": "src/"},
  "output_summary": {"match_count": 12},
  "session_id": "abc123"
}
```

The system counts tool usage by task category:
- **Content search:** Grep vs Bash(grep) vs Bash(rg)
- **File discovery:** Glob vs Bash(find) vs Bash(ls)
- **File reading:** Read vs Bash(cat) vs Bash(head)
- **File modification:** Edit vs Bash(sed) vs Bash(awk)
- **File creation:** Write vs Bash(echo >) vs Bash(cat <<EOF)

### Detection Criteria

A preference is detected when:
- One tool accounts for >70% of usage for a task category
- At least 5 observations exist for that category
- Pattern appears across 2+ sessions

### Generated Instinct

```yaml
id: prefer-grep-over-bash-search
trigger: "when searching file contents"
action: "Use Grep tool instead of Bash with grep or rg"
domain: tool-preference
```

### Example

Observations show 15 uses of Grep, 2 uses of Bash(rg), 0 uses of Bash(grep) for content search tasks. The system generates an instinct preferring Grep at confidence 0.3 + (15 observations / 2 * 0.1) = 0.3 (capped at creation-time max of 0.6).

## File Patterns

### What It Detects

Consistent naming conventions, directory structures, and file co-creation habits.

### How Observations Are Structured

```json
{
  "timestamp": "2026-02-10T10:05:00",
  "tool": "Write",
  "input_summary": {"file_path": "src/features/auth/auth.service.ts", "content_length": 320},
  "output_summary": {"success": true},
  "session_id": "abc123"
}
```

The system extracts from file paths:
- Extension patterns (`.service.ts`, `.component.tsx`, `.spec.ts`)
- Directory conventions (`features/`, `utils/`, `components/`)
- Case conventions (kebab-case, PascalCase, camelCase)
- Suffix patterns (`-handler`, `-controller`, `-service`)

### Detection Criteria

A naming pattern is detected when:
- The same convention appears in 5+ file creations
- The convention is consistent (>80% adherence)
- Files in similar directories follow the same pattern

### Generated Instinct

```yaml
id: kebab-case-feature-dirs
trigger: "when creating feature directories"
action: "Use kebab-case for directory names under src/features/"
domain: code-style
```

### Co-Creation Patterns

Detect files that are always created together:

- `.ts` + `.spec.ts` — source with test
- `.component.ts` + `.component.html` + `.component.scss` — Angular component set
- `.service.ts` + `.service.spec.ts` — service with test

```yaml
id: always-create-spec-files
trigger: "when creating .ts files in src/"
action: "Create a corresponding .spec.ts test file"
domain: testing
```

## Edit Patterns

### What It Detects

Correction behaviors, iterative refinement habits, and `replace_all` usage patterns.

### How Observations Are Structured

```json
{
  "timestamp": "2026-02-10T10:10:00",
  "tool": "Edit",
  "input_summary": {
    "file_path": "src/utils/helper.ts",
    "old_string_length": 45,
    "new_string_length": 62,
    "replace_all": false
  },
  "output_summary": {"success": true},
  "session_id": "abc123"
}
```

### Correction Detection

A correction is identified when:
1. Write creates a file
2. Edit modifies the same file within the same session
3. The edit occurs within the next few tool uses (not separated by many other operations)

This suggests the initial Write was incomplete or incorrect.

**Common correction patterns:**
- Missing imports added after initial Write
- Type annotations added after initial function definition
- Error handling added after initial implementation
- Style fixes after content creation

```yaml
id: include-imports-upfront
trigger: "when creating new TypeScript files"
action: "Include all necessary imports in the initial file write"
domain: code-style
```

### Replace-All Patterns

Track when `replace_all: true` is used:
- Renaming variables or functions across a file
- Updating import paths after restructuring
- Changing naming conventions (camelCase to snake_case)

```yaml
id: batch-rename-with-replace-all
trigger: "when renaming identifiers across a file"
action: "Use Edit with replace_all instead of multiple individual edits"
domain: tool-preference
```

### Iterative Refinement

Multiple edits to the same file in sequence indicate iterative work:
- 2 edits: normal refinement
- 3+ edits: may indicate unclear requirements or incremental approach

```yaml
id: plan-before-editing
trigger: "when about to make multiple changes to one file"
action: "Plan all changes before starting to minimize edit rounds"
domain: workflow
```

## Command Patterns

### What It Detects

Repeated bash commands or command prefixes that indicate habitual workflows.

### How Observations Are Structured

```json
{
  "timestamp": "2026-02-10T10:15:00",
  "tool": "Bash",
  "input_summary": {"command_preview": "npm test -- --coverage"},
  "output_summary": {"exit_code": 0},
  "session_id": "abc123"
}
```

Note: Command previews are truncated to 200 characters for privacy.

### Detection Criteria

A command pattern is detected when:
- The same command (or command prefix) appears 3+ times
- It appears in similar contexts (after similar preceding tools)
- It spans 2+ sessions

### Common Command Patterns

**Test commands:**
- `npm test` / `npm run test` after edits
- `pytest` after Python file changes
- `dotnet test` after C# changes

**Build commands:**
- `npm run build` after significant changes
- `tsc --noEmit` for type checking

**Git commands:**
- `git status` before commits
- `git diff` to review changes

### Generated Instinct

```yaml
id: test-after-edit
trigger: "when finishing code edits"
action: "Run npm test to verify changes"
domain: testing
```

```yaml
id: type-check-before-commit
trigger: "when about to commit TypeScript changes"
action: "Run tsc --noEmit to catch type errors"
domain: workflow
```

## Error-Fix Sequences

### What It Detects

Bash command failures followed by successful resolution actions.

### How Observations Are Structured

Failed command:
```json
{
  "timestamp": "2026-02-10T10:20:00",
  "tool": "Bash",
  "input_summary": {"command_preview": "npm test"},
  "output_summary": {"exit_code": 1, "success": false},
  "session_id": "abc123"
}
```

Resolution (1-3 tool uses later):
```json
{
  "timestamp": "2026-02-10T10:21:00",
  "tool": "Edit",
  "input_summary": {"file_path": "src/auth.service.ts", "old_string_length": 30, "new_string_length": 55},
  "output_summary": {"success": true},
  "session_id": "abc123"
}
```

### Detection Criteria

An error-fix pair is detected when:
1. A Bash command exits with non-zero code
2. Within the next 1-3 observations in the same session, a corrective action occurs
3. The corrective action targets a related file or runs the same command successfully

### Pattern Categories

**Test failure → code fix:**
- Test fails → Edit source file → Test passes
- Instinct: how to fix common test failures

**Build error → config fix:**
- Build fails → Edit config/tsconfig → Build passes
- Instinct: common build configuration issues

**Lint error → style fix:**
- Lint fails → Edit source → Lint passes
- Instinct: style rules that frequently trip up

**Import error → dependency fix:**
- Import fails → Bash(npm install) → Import succeeds
- Instinct: missing dependency patterns

### Generated Instinct

```yaml
id: fix-missing-async-await
trigger: "when encountering 'not assignable to Promise' type error"
action: "Add async keyword to the function and await to the call site"
domain: error-handling
```

```yaml
id: fix-import-not-found
trigger: "when encountering 'Cannot find module' error"
action: "Check if the package is installed, run npm install if missing"
domain: error-handling
```

## Workflow Sequences

### What It Detects

Multi-step tool chains that repeat across sessions, indicating habitual workflows.

### How Observations Are Structured

Sequences are derived from chronologically ordered observations within a session. The system uses a sliding window of 2-5 tool uses.

Example 3-step sequence:
```
[Read(src/auth.ts)] → [Edit(src/auth.ts)] → [Bash(npm test)]
```

Abstracted to:
```
Read → Edit(same file) → Bash(test)
```

### Detection Criteria

A workflow sequence is detected when:
- The same tool chain (abstracted) appears in 3+ sessions
- The chain length is 2-5 steps
- The chain preserves ordering (but allows gaps of 1 tool use)

### Common Workflow Patterns

**Read-Edit-Test cycle:**
```
Read → Edit → Bash(test)
```
The most fundamental development loop. Read a file, make changes, verify with tests.

**Find-Read-Edit pattern:**
```
Glob/Grep → Read → Edit
```
Search for relevant files, read to understand, then modify.

**Create-Test-Fix cycle:**
```
Write → Bash(test) → Edit
```
Create new file, test it, fix issues found.

**Review-Fix-Commit pattern:**
```
Bash(git diff) → Read → Edit → Bash(git add/commit)
```
Review changes, read affected files, make fixes, commit.

**Multi-file refactor:**
```
Grep → Read → Edit → Read → Edit
```
Find all occurrences, read each, edit each.

### Generated Instinct

```yaml
id: read-edit-test-cycle
trigger: "when starting to modify existing code"
action: "Follow the read-edit-test cycle: read the file first, make changes, then run tests"
domain: workflow
```

```yaml
id: search-before-edit
trigger: "when about to fix a bug or change behavior"
action: "Search for all related usages with Grep before editing to avoid breaking callers"
domain: workflow
```

## User Corrections

### What It Detects

Cases where a Write is followed by an Edit on the same file, indicating the initial content needed correction.

### Distinction from Edit Patterns

Edit patterns track all edits. User corrections specifically track Write-then-Edit pairs, which indicate the initial generation was wrong or incomplete.

### How Observations Are Structured

Write followed by Edit on the same file within the same session:

```json
// Write
{"tool": "Write", "input_summary": {"file_path": "src/new-component.tsx", "content_length": 800}, "session_id": "s1"}
// Edit shortly after
{"tool": "Edit", "input_summary": {"file_path": "src/new-component.tsx", "old_string_length": 40, "new_string_length": 65}, "session_id": "s1"}
```

### Detection Criteria

A user correction is detected when:
- Write creates a file
- Edit modifies the same file within the same session
- No more than 3 other tool uses occur between the Write and Edit
- The pattern repeats across 3+ instances (same file type or same correction type)

### What Corrections Reveal

- **Missing boilerplate** — always need to add the same imports/headers
- **Wrong defaults** — initial values consistently changed
- **Incomplete patterns** — structure created but key parts missing
- **Style mismatches** — formatting corrected post-creation

### Generated Instinct

```yaml
id: include-use-client-directive
trigger: "when creating React client components"
action: "Include 'use client' directive at the top of the file"
domain: code-style
```

```yaml
id: add-error-boundary
trigger: "when creating new page components"
action: "Include error boundary wrapper in the initial template"
domain: architecture
```

## Pattern Priority

When multiple patterns compete for instinct creation, prioritize:

1. **Error-fix sequences** — highest value, prevent future errors
2. **User corrections** — fix generation quality
3. **Workflow sequences** — improve process efficiency
4. **Tool preferences** — optimize tool usage
5. **File patterns** — maintain consistency
6. **Command patterns** — reduce repetitive typing
7. **Edit patterns** — lowest priority, often noise
