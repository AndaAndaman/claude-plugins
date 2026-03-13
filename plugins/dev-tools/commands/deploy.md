---
name: deploy
description: Ship current branch to staging/preprod and trigger Jenkins build. Usage - /deploy, /deploy ui staging, /deploy api preprod
argument-hint: "[target] [environment]"
allowed-tools:
  - AskUserQuestion
  - Agent
  - mcp__plugin_dev-tools_dev-tools__git_command
  - mcp__plugin_dev-tools_dev-tools__jenkins_build_verify
---

# Deploy Command

Ship current branch to an environment and trigger a Jenkins build. Uses combined tools for minimum round-trips.

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

**If environment missing**, default to `staging`. Only ask if ambiguous.

### 2. Resolve target branch

| Target | Staging branch | Preprod branch |
|---|---|---|
| `ui` | `a-staging` | `a-preprod` |
| `api`, `api-report`, `api-doc`, `api-profile`, `open-api` | `canary-staging` | `canary-preprod` |
| `lambda-pdf-preview`, `lambda-pdf-gen` | `a-staging` | `a-preprod` |

### 3. Ship code

Check status first with `git_command action=status`.

**If clean (nothing to commit):**
```
git_command action=merge_to target="<resolved-branch>" push=true
```
This pushes current branch and merges to the target in 1 call.

**If dirty (uncommitted changes):**
Ask the user to commit or stash first. Do NOT auto-stash.

### 4. Build + verify (1 call via bg-runner)

Run in background so user can keep working:

```
Agent(subagent_type="dev-tools:bg-runner", run_in_background=true, prompt="Use jenkins_build_verify with target=<target> environment=<environment> verify=true. Report the full result.")
```

**CRITICAL: NEVER call jenkins_build_verify directly — it blocks for minutes. ALWAYS use bg-runner agent.**

### 5. Report

When bg-runner completes, relay the result:

```
Deploy summary:
  Branch: <source> → <env-branch>
  Target: <target>
  Environment: <environment>
  Build: <SUCCESS/FAILURE>
  Healthcheck: <all OK / N failing>
```

## Examples

```bash
/deploy                      # Interactive — asks target + environment
/deploy ui staging           # Ship UI to staging (merge to a-staging)
/deploy api preprod          # Ship API to preprod (merge to canary-preprod)
/deploy lambda-pdf-gen       # Ship lambda to staging (merge to a-staging)
```
