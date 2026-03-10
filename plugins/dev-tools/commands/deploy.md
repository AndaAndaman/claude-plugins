---
name: deploy
description: Ship current branch to staging/preprod and trigger Jenkins build. Usage - /deploy, /deploy ui staging, /deploy api preprod
argument-hint: "[target] [environment]"
allowed-tools:
  - AskUserQuestion
  - mcp__plugin_dev-tools_dev-tools__git_command
  - mcp__plugin_dev-tools_dev-tools__jenkins_build
  - mcp__plugin_dev-tools_dev-tools__jenkins_status
  - mcp__plugin_dev-tools_dev-tools__jenkins_list_targets
  - Bash
---

# Deploy Command

Ship current branch to an environment and trigger a Jenkins build.

Read the ship-and-build skill for branch conventions and target details:
- `skills/ship-and-build/SKILL.md`

## Process

### 1. Parse arguments

If `[target]` and `[environment]` provided, use them directly.
Otherwise, ask using AskUserQuestion:

**If target missing**, ask:
```
Which service to build?
- ui (Frontend)
- api (API Core)
- api-report (Report API)
- api-doc (Document API)
- api-profile (Profile API)
- open-api (Open API)
- lambda-pdf-preview (PDF Preview)
- lambda-pdf-gen (PDF Generator)
```

**If environment missing**, ask:
```
Which environment?
- staging (Recommended)
- preprod
```

### 2. Resolve target branch

Look up the correct branch from the skill's Branch Conventions table:

| Target | Staging branch | Preprod branch |
|---|---|---|
| `ui` | `a-staging` | `a-preprod` |
| `api`, `api-report`, `api-doc`, `api-profile`, `open-api` | `canary-staging` | `canary-preprod` |
| `lambda-pdf-preview`, `lambda-pdf-gen` | `a-staging` | `a-preprod` |

### 3. Check working tree

Run `Bash` to check for uncommitted changes:
```bash
git status --porcelain
```

If dirty:
- Show what's uncommitted
- Ask: "You have uncommitted changes. Commit first, stash, or abort?"
- If commit: help commit, then continue
- If stash: `git stash`, continue (remind to pop later)
- If abort: stop

### 4. Push current branch to origin

Before merging, push the current branch so origin is up to date:

```bash
git push -u origin HEAD
```

### 5. Merge to environment branch

```
git_command action="merge_to" target="<resolved-branch>"
```

If conflict:
- Report the conflict details
- Suggest: "Resolve conflicts manually, then run `/deploy` again"
- Stop

### 6. Trigger build

```
jenkins_build target="<target>" environment="<environment>"
```

If environment is staging, `environment` param can be omitted.

### 7. Monitor

```
jenkins_status target="<target>"
```

### 8. Report

```
Deploy summary:
  Branch: <source> → <env-branch>
  Target: <target>
  Environment: <environment>
  Build: <status/url>
```

## Examples

```bash
/deploy                      # Interactive — asks target + environment
/deploy ui staging           # Ship UI to staging (merge to a-staging)
/deploy api preprod          # Ship API to preprod (merge to canary-preprod)
/deploy lambda-pdf-gen staging  # Ship lambda to staging (merge to a-staging)
```
