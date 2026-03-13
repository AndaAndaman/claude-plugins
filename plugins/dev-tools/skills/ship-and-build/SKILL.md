---
name: ship-and-build
description: >
  Ship current branch to staging or preprod and trigger Jenkins build.
  Use when the user says "ship to staging", "deploy to preprod", "merge and build",
  "push to staging and build", "ship it", or asks to deploy their current branch
  to an environment.
---

# Ship & Build Workflow

Pack up the current working branch, merge to the target environment branch, push to origin, and trigger a Jenkins build — using combined MCP tools for minimum round-trips.

## Quick Reference (Preferred — Combined Tools)

```
1. Push + Merge → git_ship push=true merge_to="<env-branch>"
2. Build + Verify → jenkins_build_verify target="<target>" verify=true (via bg-runner)
```

**2 MCP calls total.** Always prefer this over individual tool calls.

## Branch Conventions

The target branch to merge into depends on the build target:

| Target | Staging branch | Preprod branch |
|---|---|---|
| `ui` | `a-staging` | `a-preprod` |
| `api` | `canary-staging` | `canary-preprod` |
| `api-report` | `canary-staging` | `canary-preprod` |
| `api-doc` | `canary-staging` | `canary-preprod` |
| `api-profile` | `canary-staging` | `canary-preprod` |
| `open-api` | `canary-staging` | `canary-preprod` |
| `lambda-pdf-preview` | `a-staging` | `a-preprod` |
| `lambda-pdf-gen` | `a-staging` | `a-preprod` |

## All Build Targets

| Target | Description | Key params (staging) |
|---|---|---|
| `ui` | UI/Frontend service | BUILD_BRANCH, BUILD_SITE, app_name, SERVICE_NAME, FORCE_YARN |
| `api` | API Core service | COMMIT_HASH, BUILD_SITE, SERVICE_NAME=api-core, BASE_DOCKER=business-api |
| `api-report` | Report API service | SERVICE_NAME=report-api, BASE_DOCKER=report-api |
| `api-doc` | Document API service | SERVICE_NAME=doc-api, BASE_DOCKER=doc-api |
| `api-profile` | Profile API service | SERVICE_NAME=profile-api, BASE_DOCKER=profile-api |
| `open-api` | Open API service | SERVICE_NAME=open-api, NS=-ns, STAGE=sandbox-ns |
| `lambda-pdf-preview` | Lambda PDF Preview | BranchName=a-staging, lambda=lambda.pdf-preview |
| `lambda-pdf-gen` | Lambda PDF Generator | BranchName=a-staging, lambda=lambda.pdf-generator |

## Step-by-Step (Combined Tools)

### Step 1: Check working tree

```
git_command action=status
```

If dirty → ask user to commit or stash first.

### Step 2: Push + merge (1 call)

```
git_command action=push
git_command action=merge_to target="<env-branch>" push=true
```

Note: If user has uncommitted changes to ship, use `git_ship` instead:
```
git_ship message="<commit msg>" files="<files>" push=true merge_to="<env-branch>"
```

### Step 3: Build + verify (1 call, background)

```
Agent(subagent_type="dev-tools:bg-runner", run_in_background=true,
  prompt="Use jenkins_build_verify with target=<target> verify=true. Report the full result.")
```

This does: trigger → resolve queue → poll until complete → run healthchecks.

## Common Workflows (Combined)

### Ship UI to staging
```
git_command action=push
git_command action=merge_to target="a-staging" push=true
jenkins_build_verify target="ui" verify=true  (via bg-runner)
```

### Ship API to preprod
```
git_command action=push
git_command action=merge_to target="canary-preprod" push=true
jenkins_build_verify target="api" verify=true  (via bg-runner)
```

### Ship multiple targets
```
git_command action=push
git_command action=merge_to target="a-staging" push=true
git_command action=merge_to target="canary-staging" push=true
jenkins_build_verify target="ui" verify=true  (via bg-runner)
jenkins_build_verify target="api" verify=true  (via bg-runner)
```

## Error Handling

| Error | Cause | Action |
|---|---|---|
| Uncommitted changes | Dirty working tree | Ask user to commit first |
| Merge conflict | Divergent branches | git_ship aborts, inform user to resolve manually |
| Build FAILURE | Code issue | jenkins_build_verify returns console output |
| Healthcheck FAIL | Service not responding | Check aws_ecs describe/events for deployment status |
