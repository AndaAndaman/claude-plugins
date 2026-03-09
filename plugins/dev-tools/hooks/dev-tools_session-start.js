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
- \`git_command\` - Git shortcuts: merge_to, pull_rebase, rebase, cherry_pick, branch_cleanup

**Typical workflows:**

*AWS:* \`aws_sso_status\` -> \`aws_sso_refresh\` (if expired) -> \`aws_ecs_list\` -> \`aws_ecs_update_service\`

*Jenkins:* \`jenkins_configure\` (set token once) -> \`jenkins_list_targets\` -> \`jenkins_build\` (target + params) -> \`jenkins_status\` (monitor) -> \`jenkins_abort\` (if needed)

*Git:* \`git_command\` action=pull_rebase | action=rebase target="canary" | action=merge_to target="staging"`;

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
