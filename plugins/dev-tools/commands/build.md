---
name: build
description: Trigger a Jenkins build without merging. Usage - /build, /build ui, /build api preprod
argument-hint: "[target] [environment]"
allowed-tools:
  - AskUserQuestion
  - Agent
  - mcp__plugin_dev-tools_dev-tools__jenkins_build_verify
  - mcp__plugin_dev-tools_dev-tools__jenkins_list_targets
---

# Build Command

Trigger a Jenkins build and monitor until complete. No git merge, no branch switching — just build.

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

### 2. Build + verify (1 call via bg-runner)

Run in background so user can keep working:

```
Agent(subagent_type="dev-tools:bg-runner", run_in_background=true, prompt="Use jenkins_build_verify with target=<target> verify=true. Report the full result.")
```

This single tool call does: trigger build → resolve queue → poll until complete → run healthchecks.

### 3. Report

When bg-runner completes, relay the result to the user:

```
Build complete:
  Target: <target>
  Environment: <environment>
  Result: <SUCCESS/FAILURE>
  Healthcheck: <all OK / N failing>
```

## Examples

```bash
/build                       # Interactive — asks target
/build ui                    # Build UI on staging (default)
/build api preprod           # Build API on preprod
/build lambda-pdf-gen        # Build lambda on staging
```
