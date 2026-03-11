# Bug: Jenkins UI target sends wrong parameter names for preprod frontend job

**Date:** 2026-03-10
**File:** `src/shared/jenkins.ts`
**Severity:** High — UI preprod builds always fail with HTTP 500

---

## Description

The `ui` build target in `BUILD_TARGETS` uses parameter names that don't match the actual Jenkins preprod frontend job (`preprod/job/workspace/job/frontend`). This causes all UI preprod builds to fail with HTTP 500.

## Plugin sends (wrong)

```typescript
// BUILD_TARGETS.ui.defaults (line 97-104)
{
  COMMIT_HASH: 'a-staging',    // ❌ wrong param name
  SITE: 'acc',                  // ❌ wrong param name
  SERVICE_NAME: 'ui',           // ❌ wrong value
  FORCE_YARN: 'false',
  SOURCE_MAP_ENABLE: 'false',
  NX_RESET: 'false',            // ❌ job doesn't have this
}

// PREPROD_OVERRIDES.ui (line 207)
{ COMMIT_HASH: 'a-preprod', SITE: 'ac' }  // ❌ still wrong param names
```

## Actual Jenkins job expects

From API JSON of build #2841 (`/job/preprod/job/workspace/job/frontend/2841/api/json`):

```json
{
  "BUILD_BRANCH": "a-preprod",      // not COMMIT_HASH
  "BUILD_SITE": "a",                // not SITE, and value "a" not "ac"
  "app_name": "ui",                 // new param, not in plugin
  "SERVICE_NAME": "new-ui",         // not "ui"
  "FORCE_YARN": "yes",              // not "false"
  "SOURCE_MAP_ENABLE": false
}
```

## Parameter mapping needed

| Plugin param | Actual Jenkins param | Staging value | Preprod value |
|---|---|---|---|
| `COMMIT_HASH` | `BUILD_BRANCH` | `a-staging` | `a-preprod` |
| `SITE` | `BUILD_SITE` | `acc` | `a` |
| _(missing)_ | `app_name` | `ui` | `ui` |
| `SERVICE_NAME=ui` | `SERVICE_NAME` | `new-ui` | `new-ui` |
| `FORCE_YARN=false` | `FORCE_YARN` | `yes` | `yes` |
| `NX_RESET` | _(remove)_ | — | — |

## Suggested fix

Update `BUILD_TARGETS.ui` in `src/shared/jenkins.ts`:

```typescript
ui: {
  name: 'ui',
  description: 'UI/Frontend service',
  jobPathKey: 'ui',
  defaults: {
    BUILD_BRANCH: 'a-staging',
    BUILD_SITE: 'acc',
    app_name: 'ui',
    SERVICE_NAME: 'new-ui',
    FORCE_YARN: 'yes',
    SOURCE_MAP_ENABLE: 'false',
  },
},
```

Update `PREPROD_OVERRIDES.ui`:

```typescript
ui: { BUILD_BRANCH: 'a-preprod', BUILD_SITE: 'a' },
```

Also update `jenkins-list.tool.ts` display if it references the old param names.

## Workaround

Trigger directly via curl:

```bash
curl -X POST "http://jenkins-workspace.flowaccount.private/job/preprod/job/workspace/job/frontend/buildWithParameters" \
  --user "anda:<token>" \
  --data-urlencode "BUILD_BRANCH=a-preprod" \
  --data-urlencode "BUILD_SITE=a" \
  --data-urlencode "app_name=ui" \
  --data-urlencode "SERVICE_NAME=new-ui" \
  --data-urlencode "FORCE_YARN=yes" \
  --data-urlencode "SOURCE_MAP_ENABLE=false"
```

## Impact

- `jenkins_build target="ui"` always fails on preprod with HTTP 500
- Users must fall back to manual curl or Jenkins web UI
- Staging may also have wrong params (needs verification against actual staging job)
