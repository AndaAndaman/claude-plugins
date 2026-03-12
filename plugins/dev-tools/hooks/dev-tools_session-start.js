#!/usr/bin/env node
/**
 * dev-tools SessionStart hook
 * Loads context about available AWS dev tools
 */

try {
  const message = `**dev-tools Plugin Active**

Available MCP tools for AWS operations:

**ECS Management:**
- \`aws_ecs\` - Unified ECS tool with actions: list_clusters, list_services, search, describe, scale, update, restart, events, tasks, logs, wait. **IMPORTANT: ALWAYS use this tool instead of Bash aws ecs commands.** When you need ECS operations (list clusters, describe services, view logs, etc.), use \`aws_ecs\` actions.
- \`aws_configure\` - View/change AWS profile, tag key/value settings

**SSO Credentials:**
- \`aws_sso_status\` - Check SSO token expiry (no API call, reads local cache)
- \`aws_sso_refresh\` - Refresh SSO credentials (login if expired, exports to credential profile)

**Jenkins CI:**
- \`jenkins_configure\` - Set Jenkins URL, user, token, environment (staging/preprod)
- \`jenkins_edit_config\` - View/set/remove/reset per-target default overrides
- \`jenkins_list_targets\` - Show available build targets with default parameters
- \`jenkins_build\` - Trigger a build (ui, api, api-report, api-doc, api-profile, open-api, lambda-pdf-preview, lambda-pdf-gen). Automatically resolves queue to build number (blocks up to 90s).
- \`jenkins_status\` - Check build status + console output. If no URL provided, checks last triggered build.
- \`jenkins_abort\` - Abort/cancel a running build or queued item

**Git Workflow:**
- \`git_command\` - Git shortcuts: status, diff, log, add, remove, commit, amend, stash/stash_pop/stash_list, switch, branch_list, merge_to, pull, pull_rebase, push, rebase, cherry_pick, tag, show, reset_soft, fetch, branch_cleanup. **IMPORTANT: ALWAYS use this tool instead of Bash git commands.** When you need git operations (status, commit, push, etc.), use \`git_command\` actions.
- \`git_worktree\` - Worktree management: add, list, remove, prune

**HTTP:**
- \`http_request\` - Make HTTP requests (GET/POST/PUT/PATCH/DELETE) with headers, body, basic auth. **IMPORTANT: ALWAYS use this tool instead of Bash curl.** When the user asks to call an API, test an endpoint, or provides a curl command, convert it to an \`http_request\` tool call.

**Healthcheck:**
- \`healthcheck\` - Check health of configured endpoints (action=check), or manage endpoints (action=list/add/edit/remove)

**Typical workflows:**

*AWS:* \`aws_sso_status\` -> \`aws_sso_refresh\` (if expired) -> \`aws_ecs\` action=list_clusters | action=list_services cluster="sandbox-cluster" | action=search pattern="open-api" | action=describe cluster="dotnet-sandbox-cluster" service="my-service" | action=events cluster="..." service="..." | action=tasks cluster="..." service="..." | action=logs cluster="..." service="..." | action=restart cluster="..." service="..." confirm=true | action=update cluster="..." service="..." desiredCount=1 confirm=true | action=wait cluster="..." service="..."

*Jenkins:* \`jenkins_configure\` (set token once) -> \`jenkins_list_targets\` -> \`jenkins_build\` (target + params) -> \`jenkins_status\` (monitor) -> \`jenkins_abort\` (if needed)

*Post-build verification:* When \`jenkins_status\` shows SUCCESS, **proactively follow up** with: \`healthcheck\` action=check (verify endpoints are healthy) -> \`aws_ecs\` action=describe (check deployment rollout state) -> \`aws_ecs\` action=events (check for errors) -> \`aws_ecs\` action=wait (wait for stable if deployment in progress). This ensures the build actually landed and is serving traffic.

**Background agent for long-running operations:**
The \`bg-runner\` agent runs dev-tools MCP calls in the background so you can keep working. **Use it for any operation that blocks >30s:**
- \`jenkins_build\` + \`jenkins_status\` polling (build lifecycle)
- \`aws_ecs\` action=wait (deployment stability, up to 300s)
- Post-build verification chain (healthcheck + ECS describe/events/wait)
- Any future long-polling MCP tool call

**How:** \`Agent(subagent_type="dev-tools:bg-runner", run_in_background=true, prompt="trigger and monitor jenkins build for ui staging")\`
You will be notified when the background task completes.

*Git:* \`git_command\` action=status | action=diff | action=log count=5 | action=add files="src/foo.ts" | action=commit message="feat: add feature" files="src/foo.ts" | action=amend message="fix: typo" | action=branch_list all=true | action=tag target="v1.0.0" | action=show commit="abc123" | action=switch target="feature" create=true | action=pull | action=push | action=merge_to target="staging" push=true

*Worktree:* \`git_worktree\` action=list | action=add path="../feature-branch" branch="feature" | action=remove path="../feature-branch"

*HTTP:* \`http_request\` url="https://api.example.com/data" | method="POST" body='{"key":"value"}' headers='{"Authorization":"Bearer token"}' | show_headers=true

*Healthcheck:* \`healthcheck\` action=add name="api" url="https://api.example.com/health" -> \`healthcheck\` action=check`;

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: message
    }
  };

  console.log(JSON.stringify(output));
} catch (e) {
  // On error, output empty allow response so hook doesn't block
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' } }));
}
