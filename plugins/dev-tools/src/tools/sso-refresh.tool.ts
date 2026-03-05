import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { getSsoExpiry, SSO_PROFILE, SSO_CRED_PROFILE } from '../shared/sso.js';
import { runAws } from '../shared/aws.js';

export function registerSsoRefreshTool(server: McpServer): void {
  defineTool(
    server,
    'aws_sso_refresh',
    `Refresh AWS SSO credentials. If the SSO session is expired, triggers browser-based login. Exports credentials to the "${SSO_CRED_PROFILE}" profile in ~/.aws/credentials.`,
    {
      force: z.boolean().optional().describe('Force re-login even if session is still valid (default: false)'),
    },
    async (input) => {
      const lines: string[] = ['=== AWS SSO Credential Refresh ==='];
      const force = input.force === true;

      // Check current SSO token
      const expiry = getSsoExpiry();
      const nowMs = Date.now();
      const isValid = expiry && (expiry.expiresEpochMs - nowMs > 0);

      if (isValid && !force) {
        lines.push('[OK] SSO session is still valid, refreshing credentials...');
      } else {
        lines.push('[LOGIN] SSO session expired or force refresh, opening browser...');
        const login = runAws(['sso', 'login', '--profile', SSO_PROFILE]);
        if (login.status !== 0) {
          return errorResult(`[ERROR] SSO login failed.\n${login.stderr}`);
        }
        lines.push('[OK] SSO login successful.');
      }

      // Export credentials
      const creds = runAws(['configure', 'export-credentials', '--profile', SSO_PROFILE, '--format', 'env-no-export']);
      if (creds.status !== 0 || !creds.stdout.trim()) {
        return errorResult(`[ERROR] Could not export SSO credentials.\n${creds.stderr}\nTry: aws sso login --profile ${SSO_PROFILE}`);
      }

      // Parse env format
      const env = Object.fromEntries(
        creds.stdout.split('\n')
          .filter(l => l.includes('='))
          .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
      );

      const accessKey = env['AWS_ACCESS_KEY_ID'];
      const secretKey = env['AWS_SECRET_ACCESS_KEY'];
      const sessionToken = env['AWS_SESSION_TOKEN'];

      if (!accessKey || !secretKey) {
        return errorResult('[ERROR] Failed to parse credentials from export output.');
      }

      // Write to credential profile
      for (const [key, val] of [
        ['aws_access_key_id', accessKey],
        ['aws_secret_access_key', secretKey],
        ['aws_session_token', sessionToken],
      ]) {
        if (val) {
          const r = runAws(['configure', 'set', key, val, '--profile', SSO_CRED_PROFILE]);
          if (r.status !== 0) {
            return errorResult(`[ERROR] Failed to set ${key}: ${r.stderr}`);
          }
        }
      }

      lines.push(`[OK] Credentials written to profile: ${SSO_CRED_PROFILE}`);

      // Verify
      const verify = runAws(['sts', 'get-caller-identity', '--profile', SSO_CRED_PROFILE, '--output', 'text']);
      if (verify.status === 0) {
        lines.push(`[OK] Verified: ${verify.stdout.trim()}`);
      } else {
        lines.push('[WARN] Credentials written but verification failed.');
      }

      // Show expiry
      const newExpiry = getSsoExpiry();
      if (newExpiry) {
        const remaining = newExpiry.expiresEpochMs - Date.now();
        if (remaining > 0) {
          const hrs = Math.floor(remaining / 3_600_000);
          const mins = Math.floor((remaining % 3_600_000) / 60_000);
          lines.push(`[SSO] Expires: ${newExpiry.expiresAt} (${hrs}h ${mins}m remaining)`);
        }
      }

      lines.push('=== Done ===');
      return textResult(lines.join('\n'));
    },
  );
}
