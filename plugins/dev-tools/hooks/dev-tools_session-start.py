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

**Typical workflow:**
1. `aws_sso_status` to check if SSO session is valid
2. If expired, `aws_sso_refresh` to login and export credentials
3. `aws_ecs_list` to see running services
4. `aws_ecs_update_service` or `aws_ecs_scale` to manage services
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
