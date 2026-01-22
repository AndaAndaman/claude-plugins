# Quick Wins

> "Small improvements, big impact"

A Claude Code plugin that identifies and guides easy code improvements - changes that take 1-5 minutes but provide significant value.

## Overview

**Quick Wins** helps developers maintain high code quality through continuous small improvements. It automatically scans code for "quick wins" - improvements that are:

- **Low effort**: Takes 1-5 minutes to fix
- **High impact**: Improves readability, maintainability, or performance
- **Low risk**: Safe to apply without extensive testing
- **Objective**: Clear improvements, not stylistic preferences

## Philosophy

The best time to improve code is right after you write it, not months later. This plugin embeds that wisdom directly into your workflow:

- ✅ **Proactive** - Automatically scans after you complete tasks
- ✅ **Focused** - Only suggests quick, high-value improvements
- ✅ **Safe** - Validates changes before applying
- ✅ **Efficient** - Saves hours of technical debt accumulation

## Features

### 🤖 Quick Wins Scanner Agent

Automatically identifies improvement opportunities:

```
User: [completes a feature]
Scanner: "I noticed some code changes. Let me scan for quick wins...

Quick wins identified:
- 3 unused imports (service.ts, component.ts)
- 2 console.log statements (debug code)
- 4 'any' types (should use proper interfaces)

Estimated time: 5 minutes
Want me to fix these?"
```

**Triggers on:**
- Task completion (proactive via Stop hook)
- Explicit requests ("find quick wins", "scan for improvements")
- Before commits (best practice)

**Scans for:**
- **Code Cleanup**: Unused imports, console.log, debugger, commented code
- **Error Handling**: Missing try-catch, unhandled promises, missing validation
- **Type Safety**: 'any' types, missing type annotations
- **Modern Syntax**: var→const, old patterns, outdated constructs
- **Performance**: Missing trackBy, unnecessary re-renders, sequential awaits

### 💬 /quick-wins Command

On-demand code quality scanning:

```bash
/quick-wins                    # Scan recent changes
/quick-wins src/services/      # Scan specific directory
/quick-wins user.service.ts    # Scan specific file
```

**Features:**
- Brief, scannable output format
- Grouped by priority (Critical, High, Medium)
- Estimated time per improvement
- Interactive fix application

### 🔧 /apply-win Command

Apply specific improvements with confirmation:

```bash
/apply-win Remove unused import Observable from user.service.ts
/apply-win Add error handling to API call at line 45
/apply-win Replace 'any' with User interface in component.ts:12
```

**Safety features:**
- Shows before/after preview
- Requires confirmation
- Validates safety
- Reports completion status

### 🔒 Smart Stop Hook

Suggests improvements at the right time:

```
[You complete a feature]

Hook: "I noticed code changes. Let me scan for quick wins..."

Scanner: [Analyzes recent changes]

If issues found:
  - Present brief summary
  - Ask if you want to fix them
  - Apply fixes with your approval

If no issues:
  - Silent (doesn't interrupt)
```

**Smart behavior:**
- Skips urgent bug fixes (respects context)
- Ignores trivial changes (typo fixes)
- Only scans supported languages
- Non-blocking (you can always skip)

### 📚 Skills

Two comprehensive skills guide the scanning process:

**refactoring-patterns** - Safe refactoring techniques
- Extract function/variable
- Remove duplication
- Modern syntax updates
- Language-specific patterns (TS, Angular, .NET)

**code-quality-checks** - What constitutes a "quick win"
- Detection strategies
- Prioritization matrix
- Safety guidelines
- Output formatting

## Installation

### Option 1: Local Development

```bash
# Copy to your project
cp -r quick-wins /path/to/your/project/.claude/

# Or use as plugin directory
claude --plugin-dir ./quick-wins
```

### Option 2: Global Installation

```bash
# Copy to Claude plugins directory
cp -r quick-wins ~/.claude-plugins/

# Plugin auto-loads in all projects
```

## Supported Technologies

### Primary Support
- **TypeScript/JavaScript** - Full support for modern patterns
- **Angular** - Component, service, and RxJS patterns
- **.NET/C#** - Modern C# syntax and patterns

### Detection Capabilities

**TypeScript/JavaScript:**
- Unused imports/exports
- console.log/debugger statements
- 'any' types and missing type annotations
- var → const/let opportunities
- String concatenation → template literals
- Promise chains → async/await
- Old function syntax → arrow functions

**Angular:**
- Missing trackBy in *ngFor
- Manual subscriptions (should use async pipe)
- Missing OnPush change detection
- Old RxJS import patterns
- Non-standalone components (Angular 14+)
- Missing providedIn: 'root'

**.NET/C#:**
- Unused using statements
- Console.WriteLine in production
- Blocking .Result on async calls
- String.Format → string interpolation
- Verbose null checks → null-coalescing
- Traditional loops → LINQ

## Usage

### Automatic Mode (Recommended)

Just work normally! The plugin activates automatically:

1. **You complete a task**: Implement feature, fix bug, refactor code
2. **Scanner detects**: Analyzes recent file changes
3. **Quick wins identified**: Brief, prioritized list presented
4. **Interactive fixing**: You choose what to fix
5. **Clean code committed**: No technical debt accumulated ✅

### Manual Mode

Use commands when you need explicit scanning:

```bash
# Scan current scope
/quick-wins

# Scan specific location
/quick-wins src/components/user/

# Apply specific improvement
/apply-win Remove console.log from service.ts:45
```

### Before Committing

Best practice - scan before you commit:

```bash
# Review changes
git diff

# Scan for quick wins
/quick-wins

# Fix issues
[Apply suggested fixes]

# Commit clean code
git add . && git commit
```

## Configuration

### User Preferences

Create `.claude/quick-wins.local.md` to customize behavior:

```yaml
---
# Which types of wins to scan for
enabled_checks:
  - code_cleanup
  - error_handling
  - type_safety
  - modern_syntax
  - performance

# Excluded file patterns
exclude_patterns:
  - "*.spec.ts"
  - "*.test.js"
  - "generated/**"
  - "vendor/**"

# Minimum impact threshold
min_impact: medium  # low, medium, high

# Auto-fix safe changes (or suggest only)
auto_fix: false
---

# Quick Wins Settings

Additional notes or project-specific conventions...
```

### Per-Project Settings

Add to project's CLAUDE.md:

```markdown
## Quick Wins Configuration

Skip these patterns in our codebase:
- console.log in dev-utils/ (intentional debugging utilities)
- 'any' types in legacy/ (migration in progress)
```

## How It Works

### 1. Detection Phase

**Scanner** analyzes code using:
- Glob/Grep for pattern matching
- Read tool for file analysis
- Git integration for recent changes

### 2. Classification Phase

**Skills** validate findings:
- Is this actually an improvement?
- Is it safe to apply?
- What's the effort vs impact?

### 3. Prioritization Phase

**Scoring system** ranks by:
```
Priority = (Impact × Confidence) / Effort

High Priority: Score > 0.8
Medium Priority: Score 0.4-0.8
Low Priority: Score < 0.4
```

### 4. Presentation Phase

**Brief output** format:
```
Quick wins identified:

🔴 Critical (must fix): 3 items
🟡 High (should fix): 5 items
🟢 Medium (nice to fix): 2 items

Estimated time: 8 minutes
```

### 5. Application Phase

**Safe fixes** with validation:
1. Show what will change
2. Get confirmation
3. Apply using Edit tool
4. Verify and report

## Examples

### Example 1: After Feature Completion

```
You: "I've completed the user profile feature"

[Stop hook triggers scanner]

Scanner: "I noticed code changes. Quick scan...

Quick wins identified:

Code Cleanup (Priority 1):
- 2 console.log statements (debugging code)
- 1 unused import (Observable)

Type Safety (Priority 2):
- 3 'any' types in user.component.ts

Estimated time: 3 minutes
Want me to fix these?"

You: "yes"

Scanner: [Applies fixes]
✅ Removed 2 console.log statements
✅ Removed unused import
✅ Added User interface, replaced 'any' types

Done! Ready to commit.
```

### Example 2: Manual Scan

```
You: "/quick-wins src/services/"

Scanner: "Scanning 5 files...

Quick wins identified:

Error Handling (Priority 1):
- 2 missing try-catch blocks (API calls)

Modern Syntax (Priority 2):
- 5 var declarations
- 8 string concatenations

Estimated time: 6 minutes
Impact: High

Fix all at once or one at a time? (all/one/skip)"
```

### Example 3: Specific Fix

```
You: "/apply-win Add error handling to getUserData in user.service.ts:45"

Scanner: "Located function at user.service.ts:45

Current code:
```typescript
async getUserData(id: number) {
  const response = await this.http.get(`/api/users/${id}`);
  return response.data;
}
```

Proposed change:
```typescript
async getUserData(id: number) {
  try {
    const response = await this.http.get(`/api/users/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch user ${id}:`, error);
    throw new Error(`Unable to load user data: ${error.message}`);
  }
}
```

Type: Error handling
Risk: Low
Time: 2 minutes

Apply this change? (y/n)"
```

## Benefits

### For Developers

- 🎯 **Clarity** - Always know code is clean
- ⚡ **Speed** - Fix issues in minutes, not hours
- 😊 **Confidence** - Write code knowing it'll be reviewed
- 🧠 **Learning** - Discover better patterns

### For Teams

- 📋 **Consistency** - Standard improvement process
- 🔄 **Quality** - Continuous code quality maintenance
- 💰 **Efficiency** - Prevent technical debt accumulation
- 📈 **Velocity** - Less time fixing old code

### ROI

- **3 minutes** scanning and fixing
- **30 minutes** saved in code review
- **3 hours** saved avoiding technical debt
- **60x** return on time investment

## Best Practices

1. **Enable automatic scanning** - Let the Stop hook do its job
2. **Scan before committing** - Clean commits are happy commits
3. **Fix quick wins immediately** - Don't let them accumulate
4. **Trust the scanner** - It only suggests objective improvements
5. **Customize for your project** - Use settings to match conventions

## Troubleshooting

**Scanner not triggering:**
- Check plugin is installed correctly
- Verify you're in a supported language
- Try manual `/quick-wins` command
- Check `.claude/quick-wins.local.md` settings

**Too many suggestions:**
- Adjust `min_impact` in settings
- Add exclusion patterns
- Fix high-priority items first
- Use `/apply-win` for specific fixes

**False positives:**
- Report pattern in CLAUDE.md to skip
- Exclude specific files/directories
- Adjust detection thresholds

## Components

- **Skills**: `refactoring-patterns`, `code-quality-checks`
- **Agent**: `quick-wins-scanner`
- **Commands**: `/quick-wins`, `/apply-win`
- **Hook**: Stop (proactive scanning)

## Contributing

Contributions welcome! This plugin is part of the FlowAccount development toolkit.

## License

MIT

---

**Remember**: The best code improvements are the ones you make today, not tomorrow. Let Quick Wins help you maintain quality continuously! 🚀
