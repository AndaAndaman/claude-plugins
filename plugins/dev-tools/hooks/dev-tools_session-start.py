#!/usr/bin/env python3
"""
dev-tools SessionStart hook
Loads context about available AWS dev tools
"""

import sys
import io
import json

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def main():
    message = """**dev-tools Plugin Active**

Available MCP tools for AWS operations:

**ECS Management:**
- `aws_ecs_list` - List ECS services filtered by tags, grouped by cluster
- `aws_ecs_scale` - Scale all tagged sandbox services (preview with confirm=false)
- `aws_ecs_update_service` - Update a single ECS service desired count
- `aws_configure` - View/change AWS profile, tag key/value settings

**SSO Credentials:**
- `aws_sso_status` - Check SSO token expiry (no API call, reads local cache)
- `aws_sso_refresh` - Refresh SSO credentials (login if expired, exports to credential profile)

**Jenkins CI:**
- `jenkins_configure` - Set Jenkins URL, user, token, environment (staging/preprod)
- `jenkins_list_targets` - Show available build targets with default parameters
- `jenkins_build` - Trigger a build (ui, api, api-report, api-doc, api-profile, open-api, lambda-pdf-preview, lambda-pdf-gen)
- `jenkins_status` - Check build status + console output

**Typical workflows:**

*AWS:* `aws_sso_status` -> `aws_sso_refresh` (if expired) -> `aws_ecs_list` -> `aws_ecs_update_service`

*Jenkins:* `jenkins_configure` (set token once) -> `jenkins_list_targets` -> `jenkins_build` (target + params) -> `jenkins_status` (monitor)
"""

    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": message
        }
    }

    print(json.dumps(output))
    return 0

if __name__ == "__main__":
    sys.exit(main())
