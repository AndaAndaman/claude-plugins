# Hook Response Schema

Complete specification for hook response formats in Claude Code.

## Critical Information

**All hooks MUST return JSON with `ok` field:**

```json
{
  "ok": true  // or false
}
```

**Optional field when blocking:**

```json
{
  "ok": false,
  "systemMessage": "Explanation for user"
}
```

## Valid Responses

### Allow Action

```json
{"ok": true}
```

**When to use:**
- Action should proceed
- Validation passed
- No issues detected

### Block Action

```json
{
  "ok": false,
  "systemMessage": "Clear explanation why action is blocked"
}
```

**When to use:**
- Action should not proceed
- Validation failed
- Issues detected that require user attention

**systemMessage guidelines:**
- Be specific about what's wrong
- Provide actionable guidance
- Keep concise but informative
- Use friendly, helpful tone

## Invalid Responses

These will cause schema validation errors:

❌ **Wrong field names:**
```json
{"hookSpecificOutput": "..."}  // Invalid
{"permissionDecision": true}   // Invalid
{"allowed": true}              // Invalid
{"success": true}              // Invalid
```

❌ **Missing ok field:**
```json
{"systemMessage": "..."}  // Invalid - no ok field
{}                        // Invalid - empty
```

❌ **Wrong value types:**
```json
{"ok": "true"}   // Invalid - string instead of boolean
{"ok": 1}        // Invalid - number instead of boolean
```

❌ **Malformed JSON:**
```json
{ok: true}                    // Invalid - missing quotes
{"ok": true,}                 // Invalid - trailing comma
{"systemMessage": "test""}    // Invalid - malformed string
```

## Examples by Hook Type

### PreToolUse Hook (Allow)

```json
{
  "ok": true
}
```

### PreToolUse Hook (Block)

```json
{
  "ok": false,
  "systemMessage": "Requirements are unclear. Please clarify what 'users' means - which user table/entity?"
}
```

### PostToolUse Hook

```json
{
  "ok": true
}
```

**Note:** PostToolUse hooks typically allow (ok: true) since action already occurred. Use systemMessage to communicate findings.

### Stop Hook

```json
{
  "ok": true
}
```

### SessionStart Hook

```json
{
  "ok": true
}
```

## Common Mistakes

### Mistake 1: Using Old Schema

❌ **Old format (no longer valid):**
```json
{
  "permissionDecision": true,
  "hookSpecificOutput": "some message"
}
```

✅ **Correct format:**
```json
{
  "ok": true,
  "systemMessage": "some message"
}
```

### Mistake 2: Forgetting ok Field

❌ **Invalid:**
```json
{
  "systemMessage": "Requirements unclear"
}
```

✅ **Correct:**
```json
{
  "ok": false,
  "systemMessage": "Requirements unclear"
}
```

### Mistake 3: Wrong JSON Format

❌ **Invalid:**
```json
{ok: true}  // Missing quotes around key
```

✅ **Correct:**
```json
{"ok": true}
```

### Mistake 4: String Instead of Boolean

❌ **Invalid:**
```json
{"ok": "true"}
```

✅ **Correct:**
```json
{"ok": true}
```

## Prompt-Based Hook Prompts

When writing prompts for prompt-based hooks, explicitly specify the response format:

```
Evaluate whether requirements are clear. Return {"ok": true} if requirements specify which user table/entity is referenced, otherwise return {"ok": false, "systemMessage": "Requirements unclear - please specify which user entity"}.
```

**Prompt template:**
```
Evaluate whether [condition].
Return {"ok": true} if [criteria met],
otherwise return {"ok": false, "systemMessage": "[reason]"}.
```

## Command Hook Output

Command hooks must output JSON to stdout:

```bash
#!/bin/bash

if [ condition ]; then
  echo '{"ok": true}'
else
  echo '{"ok": false, "systemMessage": "Reason"}'
fi
```

**Important:**
- Output must be valid JSON
- Use single quotes around JSON
- Escape quotes inside systemMessage if needed

## Testing Responses

### Valid JSON Check

```bash
echo '{"ok": true}' | jq .
echo '{"ok": false, "systemMessage": "test"}' | jq .
```

### Schema Validation

```bash
# Test with validation script
bash scripts/validate-hook-schema.sh hooks/hooks.json
```

## Debugging Schema Errors

**Error:** "Schema validation failed"

**Causes:**
1. Missing `ok` field
2. Wrong field names (`permissionDecision`, `hookSpecificOutput`)
3. Wrong value type (string instead of boolean)
4. Malformed JSON

**Solution:**
1. Check JSON syntax with `jq` or JSON validator
2. Verify `ok` field exists and is boolean
3. Remove invalid fields
4. Check quotes and commas

**Error:** "Invalid hook response"

**Causes:**
1. Empty response
2. Non-JSON output
3. Multiple JSON objects
4. Output mixed with other text

**Solution:**
1. Ensure hook outputs exactly one JSON object
2. Remove debug/log statements from hook scripts
3. Test hook output in isolation

## Version History

**Current schema (2024+):**
```json
{"ok": boolean, "systemMessage"?: string}
```

**Deprecated schemas:**
```json
// No longer valid
{"permissionDecision": boolean, "hookSpecificOutput": any}
```

**Always consult official docs:**
https://code.claude.com/docs/en/hooks.md

## Summary

Hook responses must be JSON objects with:
- Required `ok` field (boolean)
- Optional `systemMessage` field (string, when ok is false)

No other fields are valid. Do not use `permissionDecision`, `hookSpecificOutput`, or custom fields.

When writing prompt-based hooks, include the response format explicitly in the prompt. When writing command hooks, output valid JSON to stdout.

Test responses with JSON validators and schema validation utilities before deployment.
