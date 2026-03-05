import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineTool, textResult } from '../shared/mcp-helpers.js';
import { getSsoExpiry } from '../shared/sso.js';

export function registerSsoStatusTool(server: McpServer): void {
  defineTool(
    server,
    'aws_sso_status',
    'Check AWS SSO session status — shows token expiry time and remaining duration. No API calls, reads from local cache only.',
    {},
    async () => {
      const expiry = getSsoExpiry();

      if (!expiry) {
        return textResult('[SSO] No cached SSO token found. Run aws_sso_refresh to login.');
      }

      const nowMs = Date.now();
      const remainingMs = expiry.expiresEpochMs - nowMs;

      if (remainingMs <= 0) {
        return textResult(`[SSO] Session EXPIRED at: ${expiry.expiresAt}\nRun aws_sso_refresh to renew.`);
      }

      const hrs = Math.floor(remainingMs / 3_600_000);
      const mins = Math.floor((remainingMs % 3_600_000) / 60_000);

      return textResult(`[SSO] Expires: ${expiry.expiresAt} (${hrs}h ${mins}m remaining)`);
    },
  );
}
