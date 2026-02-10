---
name: hook-development
description: This skill should be used when the user asks to "create a hook", "add a PreToolUse hook", "validate tool use", "implement prompt-based hooks", "configure hook events", or mentions hook events (PreToolUse, PostToolUse, Stop, SessionStart). Provides comprehensive guidance for creating and implementing Claude Code plugin hooks with focus on advanced prompt-based hooks API.
---

# Claude Code Hook Development

## Purpose

Create event-driven automation for Claude Code plugins using hooks. Hooks execute automatically in response to events like tool calls, session lifecycle, or user interactions. This skill covers hook configuration, prompt-based evaluation, and best practices.

## When to Use

Use this skill when:
- Creating validation hooks (PreToolUse)
- Adding post-action automation (PostToolUse)
- Implementing stop/completion handlers (Stop, SubagentStop)
- Setting up session lifecycle hooks (SessionStart, SessionEnd)
- Building intelligent event handlers with LLM evaluation
- Need examples of working hook patterns

## Hook Basics

### Hook Events

Claude Code supports these hook events:

**Tool lifecycle:**
- `PreToolUse` - Before tool execution (can block)
- `PostToolUse` - After tool execution

**Task lifecycle:**
- `Stop` - When task completes or user stops
- `SubagentStop` - When subagent completes

**Session lifecycle:**
- `SessionStart` - At session beginning
- `SessionEnd` - At session end
- `UserPromptSubmit` - After user submits prompt
- `PreCompact` - Before context compaction
- `Notification` - On system notifications

### Hook Types

**Prompt-based hooks** (recommended for complex logic):
- LLM evaluates whether to allow/block action
- Access to full conversation context
- Intelligent decision-making
- Returns `{"ok": boolean}` schema

**Command hooks** (for deterministic logic):
- Execute bash command
- Faster for simple checks
- Returns `{"ok": boolean}` schema

## Configuration

### Hook File Location

Create `hooks/hooks.json` in plugin root:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
└── hooks/
    └── hooks.json
```

### Basic Structure

```json
{
  "PreToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "prompt",
      "prompt": "Check if requirements are clear before writing code...",
      "timeout": 10000
    }]
  }]
}
```

### Response Schema

**CRITICAL:** All hooks must return:

```json
{"ok": true}   // Allow action
{"ok": false, "systemMessage": "Reason"}  // Block action
```

See `references/hook-response-schema.md` for complete schema details.

## Prompt-Based Hooks

### When to Use

Use prompt-based hooks when:
- Logic requires understanding context
- Need intelligent evaluation ("are requirements clear?")
- Decision involves conversation history
- Want natural language reasoning

### Configuration

```json
{
  "type": "prompt",
  "prompt": "Evaluate whether [condition]. Return {\"ok\": true} if [criteria], otherwise {\"ok\": false, \"systemMessage\": \"reason\"}.",
  "timeout": 10000
}
```

**Prompt guidelines:**
- Be specific about criteria
- Include response format in prompt
- Set appropriate timeout (10000ms recommended)
- Reference conversation context as needed

### Examples

See `examples/` directory for complete working examples:
- `examples/pre-write-validation.json` - Validates before writing code
- `examples/stop-hook-quick-wins.json` - Triggers quality scan after completion
- `examples/session-start-setup.json` - Initializes session state

## Tool Matchers

### Matching Tools

Use `matcher` field to specify which tools trigger the hook:

```json
{
  "matcher": "Write|Edit",  // Matches Write OR Edit
  "matcher": "Write",       // Matches only Write
  "matcher": ".*",          // Matches all tools
}
```

**Common patterns:**
- `"Write|Edit"` - File modification hooks
- `"Bash"` - Command execution hooks
- `"Read"` - File read hooks
- `".*"` - All tools (use sparingly)

### Tool-Specific Hooks

Different hooks for different tools:

```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [{"type": "prompt", "prompt": "Validate code quality..."}]
    },
    {
      "matcher": "Bash",
      "hooks": [{"type": "prompt", "prompt": "Check command safety..."}]
    }
  ]
}
```

## Hook Best Practices

**Do:**
- ✅ Use prompt-based hooks for intelligent decisions
- ✅ Set reasonable timeouts (10000ms for evaluation)
- ✅ Return correct schema `{"ok": boolean}`
- ✅ Provide helpful systemMessage when blocking
- ✅ Be specific in matcher patterns
- ✅ Test hooks thoroughly

**Don't:**
- ❌ Block legitimate work unnecessarily
- ❌ Use overly broad matchers (`.*` on all hooks)
- ❌ Return wrong schema format
- ❌ Forget timeout configuration
- ❌ Make hooks too restrictive

## Common Patterns

For detailed patterns and implementation examples, see:
- **`references/validation-patterns.md`** - PreToolUse validation hooks
- **`references/automation-patterns.md`** - PostToolUse and Stop hooks
- **`references/session-patterns.md`** - Session lifecycle hooks

## Testing Hooks

### Validation

Use validation utilities in `scripts/`:
```bash
bash scripts/validate-hook-schema.sh hooks/hooks.json
```

### Testing

Test hooks with sample events:
```bash
bash scripts/test-hook.sh hooks/hooks.json PreToolUse Write
```

### Debug Mode

Run Claude Code with debug flag to see hook execution:
```bash
claude --debug
```

## Troubleshooting

**Hook not triggering:**
- Check matcher pattern matches tool name
- Verify hooks.json syntax with validator
- Ensure hook event name is correct
- Check plugin is enabled

**Schema validation errors:**
- Verify response format: `{"ok": boolean}`
- Don't use `hookSpecificOutput` or `permissionDecision`
- Check for malformed JSON in systemMessage
- Consult `references/hook-response-schema.md`

**Timeout errors:**
- Increase timeout value (default 10000ms)
- Simplify prompt evaluation logic
- Check for infinite loops in command hooks

## Summary

Hooks provide event-driven automation for Claude Code plugins. Use prompt-based hooks for intelligent evaluation, configure with proper matchers and timeouts, and always return correct `{"ok": boolean}` schema. Test thoroughly with validation utilities before deployment.

## Additional Resources

### Reference Files

For detailed patterns and techniques:
- **`references/hook-response-schema.md`** - Complete response schema specification
- **`references/validation-patterns.md`** - PreToolUse hook patterns
- **`references/automation-patterns.md`** - PostToolUse and Stop hook patterns
- **`references/session-patterns.md`** - Session lifecycle patterns

### Example Files

Working hook configurations in `examples/`:
- **`pre-write-validation.json`** - Validates before code writing
- **`stop-hook-quick-wins.json`** - Quality scan after completion
- **`session-start-setup.json`** - Session initialization

### Utility Scripts

Hook development utilities in `scripts/`:
- **`validate-hook-schema.sh`** - Validate hooks.json schema
- **`test-hook.sh`** - Test hook with sample events
