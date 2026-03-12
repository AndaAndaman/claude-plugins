---
name: ship
description: Bump plugin version, commit all changes, and push to remote. Shortcut for the release workflow.
arguments:
  - name: version
    description: "Version bump type: patch (0.0.x), minor (0.x.0), or explicit version (e.g. 1.2.3). Default: patch"
    required: false
  - name: message
    description: "Custom commit message. Auto-generated if omitted."
    required: false
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
  - Bash
argument-hint: "[patch|minor|major|x.y.z] [commit message]"
---

# Ship Command

Bump version, commit, and push in one step.

**IMPORTANT:** Execute steps sequentially. Do NOT skip steps. Do NOT combine steps. Complete each step fully before moving to the next.

## Workflow

### Step 1: Determine version

- If `[version]` is a semver (e.g. `1.2.3`), use it directly
- If `patch` (default): increment patch (0.7.0 → 0.7.1)
- If `minor`: increment minor (0.7.0 → 0.8.0)
- If `major`: increment major (0.7.0 → 1.0.0)

### Step 2: Find plugin to bump

Look at the git diff to determine which plugin(s) changed:
- Run `git diff --name-only` and `git diff --cached --name-only` to see all changes
- Check `plugins/*/src/` for modified files
- Read the plugin's `.claude-plugin/plugin.json` for current version
- Also check `.claude-plugin/marketplace.json` for the marketplace entry

If changes span multiple plugins, ask the user which one to bump.

### Step 3: Bump version in ALL version files

**MANDATORY** — Update ALL THREE files. Missing any causes version drift:

1. `plugins/<name>/.claude-plugin/plugin.json` — `version` field
2. `.claude-plugin/marketplace.json` — matching plugin's `version` field
3. `plugins/<name>/src/main.ts` — version string in `new McpServer(...)` (MCP plugins only)

**Verify:** After editing, read all three files back to confirm versions match.

### Step 4: Build (if applicable)

If the plugin has a build step (check for `package.json` with `build` script):
```bash
cd plugins/<name> && npm run build
```

**MANDATORY:** Build MUST happen AFTER version bump so the dist includes the new version.

Verify the build succeeds (exit code 0). If it fails, fix the error before continuing.

### Step 5: Update README and session-start hook

Evaluate whether updates are needed:

**MUST update** when:
- New tools/commands/agents added
- Tools/commands removed or renamed
- Tool parameters changed (new actions, new params)
- New workflows or usage patterns

**Skip** when:
- Bug fixes with no user-facing changes
- Internal refactoring
- Config tweaks

When updating:
- Update the root `README.md` tool lists, descriptions, and usage examples
- Update plugin's own `README.md` if it has tool documentation
- Keep changes minimal — only update sections affected by the code changes

**Session-start hook alignment (MANDATORY for MCP plugins):**

If `plugins/<name>/hooks/` contains a session-start hook (e.g. `dev-tools_session-start.js`):
1. Read the hook file
2. Compare the tool list and action enums in the hook against the actual registered tools in source
3. If any tools, actions, or parameters are missing or outdated in the hook, update it
4. Verify workflow examples in the hook reflect current capabilities

This prevents stale instructions that cause Claude to miss new tools or use wrong action names.

### Step 6: Commit

Stage specific files (NEVER use `git add -A` or `git add .`):
- Changed source files
- Updated plugin.json and marketplace.json
- Built dist files (if any)
- Updated README/docs (if any)

Commit message:
- If `[message]` provided, use it as the commit message
- Otherwise auto-generate: `<summary of changes> (v<new-version>)`
- Always append: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

### Step 7: Push

```bash
git push
```

If push fails (e.g. remote has new commits), run `git pull --rebase` then push again.

### Step 8: Report

Output exactly this format:
```
Shipped <plugin-name> v<version>
  Files: <count> changed
  Commit: <short-hash> <message>
  Pushed to origin/<branch>
```
