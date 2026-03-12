#!/usr/bin/env node
/**
 * dev-tools SessionStart hook
 * Loads context about available AWS dev tools
 */

try {
  const message = `**dev-tools Plugin Active**

Available MCP tools for AWS operations:

**ECS Management:**
- \`aws_ecs_list\` - List ECS services filtered by tags, grouped by cluster
- \`aws_ecs_scale\` - Scale all tagged sandbox services (preview with confirm=false)
- \`aws_ecs_update_service\` - Update a single ECS service desired count
- \`aws_configure\` - View/change AWS profile, tag key/value settings

**SSO Credentials:**
- \`aws_sso_status\` - Check SSO token expiry (no API call, reads local cache)
- \`aws_sso_refresh\` - Refresh SSO credentials (login if expired, exports to credential profile)

**Jenkins CI:**
- \`jenkins_configure\` - Set Jenkins URL, user, token, environment (staging/preprod)
- \`jenkins_edit_config\` - View/set/remove/reset per-target default overrides
- \`jenkins_list_targets\` - Show available build targets with default parameters
- \`jenkins_build\` - Trigger a build (ui, api, api-report, api-doc, api-profile, open-api, lambda-pdf-preview, lambda-pdf-gen)
- \`jenkins_status\` - Check build status + console output
- \`jenkins_abort\` - Abort/cancel a running build or queued item

**Git Workflow:**
- \`git_command\` - Git shortcuts: status, diff, log, add, remove, commit, amend, stash/stash_pop/stash_list, switch, branch_list, merge_to, pull, pull_rebase, push, rebase, cherry_pick, tag, show, reset_soft, fetch, branch_cleanup
- \`git_worktree\` - Worktree management: add, list, remove, prune

**HTTP:**
- \`http_request\` - Make HTTP requests (GET/POST/PUT/PATCH/DELETE) with headers, body, basic auth. **IMPORTANT: ALWAYS use this tool instead of Bash curl.** When the user asks to call an API, test an endpoint, or provides a curl command, convert it to an \`http_request\` tool call.

**Healthcheck:**
- \`healthcheck\` - Check health of configured endpoints (action=check), or manage endpoints (action=list/add/edit/remove)

**Typical workflows:**

*AWS:* \`aws_sso_status\` -> \`aws_sso_refresh\` (if expired) -> \`aws_ecs_list\` -> \`aws_ecs_update_service\`

*Jenkins:* \`jenkins_configure\` (set token once) -> \`jenkins_list_targets\` -> \`jenkins_build\` (target + params) -> \`jenkins_status\` (monitor) -> \`jenkins_abort\` (if needed)

*Git:* \`git_command\` action=status | action=diff | action=log count=5 | action=add files="src/foo.ts" | action=commit message="feat: add feature" files="src/foo.ts" | action=amend message="fix: typo" | action=branch_list all=true | action=tag target="v1.0.0" | action=show commit="abc123" | action=switch target="feature" create=true | action=pull | action=push | action=merge_to target="staging"

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
