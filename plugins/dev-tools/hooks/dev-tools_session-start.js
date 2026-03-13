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
- \`jenkins_build\` - Trigger a build (ui, api, api-report, api-doc, api-profile, open-api, lambda-pdf-preview, lambda-pdf-gen). Accepts optional \`environment\` param ("staging"|"preprod"). Resolves queue to build number (blocks up to 90s).
- \`jenkins_build_verify\` - **Combined workflow:** trigger build + poll until complete + run healthchecks — all in 1 call. Use this instead of sequential jenkins_build → jenkins_status → healthcheck. Accepts optional \`environment\` param ("staging"|"preprod"). Example: {target: "ui", environment: "staging", verify: true}. **Always run via bg-runner agent** (blocks for minutes).
- \`jenkins_status\` - Check build status + console output. **One-off check only — NEVER call in a loop to poll.** Use \`jenkins_build_verify\` instead.
- \`jenkins_history\` - Show recent build history for a target. Example: {target: "ui", count: 5}. Shows build number, result, branch, service, who triggered, and time ago.
- \`jenkins_abort\` - Abort/cancel a running build or queued item

**Git Workflow:**
- \`git_command\` - Git shortcuts: status, diff, log, add, remove, commit, amend, stash/stash_pop/stash_list, switch, branch_list, merge_to, pull, pull_rebase, push, rebase, cherry_pick, tag, show, reset_soft, fetch, branch_cleanup. **IMPORTANT: ALWAYS use this tool instead of Bash git commands.** When you need git operations (status, commit, push, etc.), use \`git_command\` actions.
- \`git_ship\` - **Combined workflow:** commit + push + optional merge_to — all in 1 call. Use this instead of sequential git_command add → commit → push → merge_to. Example: {message: "feat: add X", files: "src/foo.ts", push: true, merge_to: "a-staging"}
- \`git_worktree\` - Worktree management: add, list, remove, prune

**HTTP:**
- \`http_request\` - Make HTTP requests (GET/POST/PUT/PATCH/DELETE) with headers, body, basic auth. **IMPORTANT: ALWAYS use this tool instead of Bash curl.** When the user asks to call an API, test an endpoint, or provides a curl command, convert it to an \`http_request\` tool call.

**Healthcheck:**
- \`healthcheck\` - Check health of configured endpoints (action=check), or manage endpoints (action=list/add/edit/remove)

**PREFER combined tools over sequential calls** (each MCP round-trip costs full base context):

*Shipping code:* **USE \`git_ship\`** message="feat: add X" files="src/foo.ts" push=true merge_to="a-staging" — stages, commits, pushes, and merges in 1 call. Only fall back to \`git_command\` for individual operations (status, diff, log, switch, stash, etc.).

*Building + verifying:* **USE \`jenkins_build_verify\`** target="ui" verify=true — triggers build, polls until done, runs healthchecks in 1 call. **Always run via bg-runner agent** (blocks for minutes). Only use separate \`jenkins_build\` when you need to abort mid-build.

**NEVER loop-call \`jenkins_status\` to poll build progress** — each call costs 25K+ tokens of base context. Use \`jenkins_build_verify\` which polls internally in 1 call. Only use \`jenkins_status\` for a single one-off check (e.g., "what's the status of build #1234?").

**Background agent for long-running operations:**
The \`bg-runner\` agent runs dev-tools MCP calls in the background so you can keep working. **Use it for any operation that blocks >30s:**
- \`jenkins_build_verify\` (the preferred way — build + poll + healthcheck in one call)
- \`aws_ecs\` action=wait (deployment stability, up to 300s)
- Any future long-polling MCP tool call

**How:** \`Agent(subagent_type="dev-tools:bg-runner", run_in_background=true, prompt="trigger and monitor jenkins build for ui staging")\`
You will be notified when the background task completes.

**Individual tools (use when combined tools don't fit):**

*AWS:* \`aws_sso_status\` -> \`aws_sso_refresh\` (if expired) -> \`aws_ecs\` action=list_clusters | action=list_services cluster="sandbox-cluster" | action=search pattern="open-api" | action=describe cluster="dotnet-sandbox-cluster" service="my-service" | action=events | action=tasks | action=logs | action=restart confirm=true | action=update desiredCount=1 confirm=true | action=wait

*Jenkins (individual):* \`jenkins_configure\` (set token once) -> \`jenkins_list_targets\` -> \`jenkins_build\` -> \`jenkins_status\` (one-off only, NEVER loop) -> \`jenkins_history\` target="ui" -> \`jenkins_abort\`

*Git (individual):* \`git_command\` action=status | action=diff | action=log | action=switch | action=stash | action=branch_list | action=tag | action=show | action=amend | action=rebase | action=cherry_pick | action=reset_soft | action=fetch | action=branch_cleanup

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
