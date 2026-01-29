# Bug Report: SessionStart hooks incorrectly deduplicated across plugins

**Environment:**
- Claude Code version: 2.1.23
- OS: Windows 11
- Installation: Local marketplace

---

## Description

When multiple plugins define SessionStart hooks with the same command pattern (e.g., `python "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.py"`), Claude Code incorrectly deduplicates them to a single hook execution, even though `${CLAUDE_PLUGIN_ROOT}` expands to different plugin directories.

## Steps to Reproduce

1. Create two plugins with SessionStart hooks:
   - Plugin A: `ask-before-code`
   - Plugin B: `quick-wins`

2. Both hooks use identical command pattern in their `hooks/hooks.json`:
   ```json
   {
     "SessionStart": [
       {
         "matcher": "*",
         "hooks": [
           {
             "type": "command",
             "command": "python \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.py\"",
             "timeout": 5
           }
         ]
       }
     ]
   }
   ```

3. Each plugin has different `hooks/session-start.py` with different output using `hookSpecificOutput.additionalContext` format

4. Enable both plugins in settings

5. Start Claude Code with `claude --debug` flag

6. Check startup output and debug logs

## Expected Behavior

According to [official documentation](https://code.claude.com/docs/en/hooks#sessionstart-decision-control):
> "Multiple hooks' `additionalContext` values are concatenated."

**Expected:** Both SessionStart hooks should execute, and their `additionalContext` values should be concatenated and displayed.

## Actual Behavior

**Actual:** Only ONE hook executes. The other is silently deduplicated.

Debug log evidence (line 134-136):
```
Getting matching hook commands for SessionStart with query: startup
Found 2 hook matchers in settings
Matched 1 unique hooks for query "startup" (2 before deduplication)
```

Key line: `Matched 1 unique hooks for query "startup" (2 before deduplication)`

This proves:
- ✅ Both hooks were found (2 hook matchers)
- ❌ Deduplicated to 1 unique hook
- ❌ Only 1 hook executed

## Root Cause

The deduplication logic compares raw command strings **before** `${CLAUDE_PLUGIN_ROOT}` variable expansion, causing:

- `ask-before-code: python "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.py"`
- `quick-wins: python "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.py"`

To be treated as identical duplicates, even though they expand to completely different paths:

- `C:\Users\...\cache\flowaccount-dev-tools\ask-before-code\0.3.2\hooks\session-start.py`
- `C:\Users\...\cache\flowaccount-dev-tools\quick-wins\0.3.2\hooks\session-start.py`

## Impact

- Plugin developers cannot use standard naming conventions for hook scripts
- Documentation claims concatenation behavior that doesn't work in practice
- Multiple plugins with SessionStart hooks cannot coexist properly
- No error or warning is shown to users when deduplication occurs

## Proposed Fix

**Option 1 (Preferred):** Perform deduplication AFTER variable expansion (`${CLAUDE_PLUGIN_ROOT}`, etc.)

**Option 2:** Include plugin context in uniqueness check, so hooks from different plugins are never considered duplicates

**Option 3:** Document the limitation and recommend unique script names per plugin

## Workaround

Use unique script names in each plugin:
- Plugin A: `session-start-ask-before-code.py`
- Plugin B: `session-start-quick-wins.py`

This makes the commands different enough to avoid deduplication.

## Additional Notes

This same issue likely affects other hook types (Stop, PreToolUse, etc.) with similar deduplication logic.

The official documentation should be updated to clarify whether:
1. This is intended behavior (and document the workaround)
2. This is a bug (and fix the deduplication logic)

## Full Debug Log

Available upon request. Key sections:
- Line 58: ask-before-code hooks loaded
- Line 76: quick-wins hooks loaded
- Line 84: "Registered 3 hooks from 7 plugins"
- Line 136: "Matched 1 unique hooks for query 'startup' (2 before deduplication)"
- Line 169: Only quick-wins output processed

---

**Repository for reproduction:**
https://github.com/AndaAndaman/claude-plugins

Plugins affected:
- `plugins/ask-before-code` (v0.3.2)
- `plugins/quick-wins` (v0.3.2)
