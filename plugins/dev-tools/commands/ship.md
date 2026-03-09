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

## Workflow

### Step 1: Determine version

- If `[version]` is a semver (e.g. `1.2.3`), use it directly
- If `patch` (default): increment patch (0.7.0 → 0.7.1)
- If `minor`: increment minor (0.7.0 → 0.8.0)
- If `major`: increment major (0.7.0 → 1.0.0)

### Step 2: Find plugin to bump

Look at the git diff to determine which plugin(s) changed:
- Check `plugins/*/src/` for modified files
- Read the plugin's `.claude-plugin/plugin.json` for current version
- Also check `.claude-plugin/marketplace.json` for the marketplace entry

If changes span multiple plugins, ask the user which one to bump.

### Step 3: Bump version

Update both files:
1. `plugins/<name>/.claude-plugin/plugin.json` — `version` field
2. `.claude-plugin/marketplace.json` — matching plugin's `version` field

### Step 4: Build (if applicable)

If the plugin has a build step (check for `package.json` with `build` script):
```bash
cd plugins/<name> && npm run build
```

### Step 5: Commit

Stage all changes and commit:
- If `[message]` provided, use it as the commit message
- Otherwise auto-generate: `<summary of changes> (v<new-version>)`
- Always append: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

Stage specific files (not `git add -A`):
- Changed source files
- Updated plugin.json and marketplace.json
- Built dist files (if any)

### Step 6: Push

```bash
git push
```

### Step 7: Report

Output:
```
Shipped <plugin-name> v<version>
  Files: <count> changed
  Commit: <short-hash> <message>
  Pushed to origin/<branch>
```
