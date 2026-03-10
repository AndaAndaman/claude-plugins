---
name: build
description: Trigger a Jenkins build without merging. Usage - /build, /build ui, /build api preprod
argument-hint: "[target] [environment]"
allowed-tools:
  - AskUserQuestion
  - mcp__plugin_dev-tools_dev-tools__jenkins_build
  - mcp__plugin_dev-tools_dev-tools__jenkins_status
  - mcp__plugin_dev-tools_dev-tools__jenkins_list_targets
---

# Build Command

Trigger a Jenkins build. No git merge, no branch switching — just build.

Read the ship-and-build skill for target details and environment parameters:
- `skills/ship-and-build/SKILL.md`

## Build Targets & Environment Parameters

Each target builds a specific service. The plugin auto-applies correct params per environment.

| Target | Description | Staging branch/key param | Preprod overrides |
|---|---|---|---|
| `ui` | UI/Frontend | BUILD_BRANCH=a-staging, BUILD_SITE=acc | BUILD_BRANCH=a-preprod, BUILD_SITE=a |
| `api` | API Core | COMMIT_HASH=canary-staging, BUILD_SITE=acc, STAGE=sandbox | COMMIT_HASH=canary-preprod, BUILD_SITE=ac, STAGE=preprod |
| `api-report` | Report API | COMMIT_HASH=canary-staging, BUILD_SITE=acc, STAGE=sandbox | COMMIT_HASH=canary-preprod, BUILD_SITE=ac, STAGE=preprod |
| `api-doc` | Document API | COMMIT_HASH=canary-staging, BUILD_SITE=acc, STAGE=sandbox | COMMIT_HASH=canary-preprod, BUILD_SITE=ac, STAGE=preprod |
| `api-profile` | Profile API | COMMIT_HASH=canary-staging, BUILD_SITE=acc, STAGE=sandbox | COMMIT_HASH=canary-preprod, BUILD_SITE=ac, STAGE=preprod |
| `open-api` | Open API | COMMIT_HASH=canary-staging, NS=-ns, STAGE=sandbox-ns | COMMIT_HASH=canary-preprod, STAGE=preprod-ns |
| `lambda-pdf-preview` | PDF Preview | BranchName=a-staging, configuration=staging | BranchName=a-preprod, configuration=preprod |
| `lambda-pdf-gen` | PDF Generator | BranchName=a-staging, configuration=staging | BranchName=a-preprod, configuration=preprod |

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

### 2. Trigger build

```
jenkins_build target="<target>" environment="<environment>"
```

If environment is staging, `environment` param can be omitted.

### 3. Monitor

```
jenkins_status target="<target>"
```

Report build status. If failed, show console output excerpt.

### 4. Report

```
Build triggered:
  Target: <target>
  Environment: <environment>
  Build: <status/url>
```

## Examples

```bash
/build                       # Interactive — asks target + environment
/build ui                    # Build UI on staging (default)
/build api preprod           # Build API on preprod
/build lambda-pdf-gen staging   # Build lambda on staging
```
