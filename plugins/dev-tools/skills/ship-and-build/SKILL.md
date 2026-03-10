---
name: ship-and-build
description: >
  Ship current branch to staging or preprod and trigger Jenkins build.
  Use when the user says "ship to staging", "deploy to preprod", "merge and build",
  "push to staging and build", "ship it", or asks to deploy their current branch
  to an environment.
---

# Ship & Build Workflow

Pack up the current working branch, merge to the target environment branch, push to origin, and trigger a Jenkins build — all via dev-tools MCP tools.

## Quick Reference

```
1. Commit    → user commits (or already committed)
2. Merge     → git_command action=merge_to target="<env-branch>"
3. Build     → jenkins_build target="<target>" environment="staging|preprod"
4. Monitor   → jenkins_status target="<target>"
```

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

Always ask the user which target they want to build — the target determines which branch to merge into.

## All Build Targets

| Target | Description | Job type | Key params (staging) |
|---|---|---|---|
| `ui` | UI/Frontend service | workspace/frontend | BUILD_BRANCH, BUILD_SITE, app_name, SERVICE_NAME, FORCE_YARN |
| `api` | API Core service | dotnet/dotnet.arm64 | COMMIT_HASH, BUILD_SITE, SERVICE_NAME=api-core, BASE_DOCKER=business-api |
| `api-report` | Report API service | dotnet/dotnet.arm64 | SERVICE_NAME=report-api, BASE_DOCKER=report-api |
| `api-doc` | Document API service | dotnet/dotnet.arm64 | SERVICE_NAME=doc-api, BASE_DOCKER=doc-api |
| `api-profile` | Profile API service | dotnet/dotnet.arm64 | SERVICE_NAME=profile-api, BASE_DOCKER=profile-api |
| `open-api` | Open API service | dotnet/dotnet.arm64 | SERVICE_NAME=open-api, NS=-ns, STAGE=sandbox-ns |
| `lambda-pdf-preview` | Lambda PDF Preview | workspace/serverless | BranchName=a-staging, lambda=lambda.pdf-preview |
| `lambda-pdf-gen` | Lambda PDF Generator | workspace/serverless | BranchName=a-staging, lambda=lambda.pdf-generator |

## Step-by-Step

### Step 1: Verify clean working tree

Before merging, the current branch must have no uncommitted changes.

- If uncommitted changes exist → ask the user to commit first (or offer to help commit)
- If clean → proceed

### Step 2: Determine environment and target

Ask the user if not specified:
- **Environment**: staging or preprod?
- **Build target**: which service? (see table above)

### Step 3: Merge to environment branch

Use the git_command MCP tool with the correct branch from the Branch Conventions table:

```
git_command action="merge_to" target="<env-branch>"
```

Examples:
- Ship UI to staging → `git_command action="merge_to" target="a-staging"`
- Ship API to preprod → `git_command action="merge_to" target="canary-preprod"`
- Ship lambda-pdf-preview to staging → `git_command action="merge_to" target="a-staging"`

This will:
- Check for uncommitted changes (fails if dirty)
- Switch to target branch, pull latest
- Merge the source branch, push to origin
- Switch back to original branch

**If merge conflicts occur:**
- `git_command` will abort and return an error
- Fall back to manual resolution: inform the user, let them resolve conflicts, then retry

### Step 4: Trigger Jenkins build

```
jenkins_build target="<target>" environment="<environment>"
```

- **Staging**: `environment` can be omitted (default)
- **Preprod**: must specify `environment="preprod"`

The plugin automatically applies correct parameters per environment (PREPROD_OVERRIDES). No need to specify individual params.

### Step 5: Monitor build

```
jenkins_status target="<target>"
```

Report build status. If failed, show console output excerpt.

## Common Workflows

### Ship UI to staging
```
git_command action="merge_to" target="a-staging"
jenkins_build target="ui"
jenkins_status target="ui"
```

### Ship UI to preprod
```
git_command action="merge_to" target="a-preprod"
jenkins_build target="ui" environment="preprod"
jenkins_status target="ui"
```

### Ship API to staging
```
git_command action="merge_to" target="canary-staging"
jenkins_build target="api"
jenkins_status target="api"
```

### Ship API to preprod
```
git_command action="merge_to" target="canary-preprod"
jenkins_build target="api" environment="preprod"
jenkins_status target="api"
```

### Ship lambda-pdf-preview to staging
```
git_command action="merge_to" target="a-staging"
jenkins_build target="lambda-pdf-preview"
jenkins_status target="lambda-pdf-preview"
```

### Ship multiple targets to same environment
Merge to each required branch, then build:
```
git_command action="merge_to" target="a-staging"
git_command action="merge_to" target="canary-staging"
jenkins_build target="ui"
jenkins_build target="api"
jenkins_status target="ui"
jenkins_status target="api"
```

## Error Handling

| Error | Cause | Action |
|---|---|---|
| Uncommitted changes | Dirty working tree | Ask user to commit first |
| Merge conflict | Divergent branches | Inform user, let them resolve manually, retry |
| HTTP 500 on build | Wrong params or Jenkins down | Check `jenkins_status`, verify `jenkins_configure` |
| Build FAILURE | Code issue | Show console output from `jenkins_status` |
| SSO expired | AWS credentials stale | Run `aws_sso_refresh` if needed |
