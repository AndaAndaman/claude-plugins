import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fromIni } from '@aws-sdk/credential-providers';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { defineTool, textResult, errorResult } from '../shared/mcp-helpers.js';
import { getSsoExpiry, SSO_PROFILE, SSO_CRED_PROFILE } from '../shared/sso.js';
import { DEFAULT_REGION } from '../shared/aws-client.js';
import { runAws } from '../shared/aws.js';

const CREDENTIALS_FILE = join(homedir(), '.aws', 'credentials');

/** Read ~/.aws/credentials as a string, returning '' if missing. */
function readCredentialsFile(): string {
  try {
    return readFileSync(CREDENTIALS_FILE, 'utf8');
  } catch {
    return '';
  }
}

/** Write a profile section into ~/.aws/credentials, replacing if it exists. */
function writeCredentialProfile(profile: string, accessKeyId: string, secretAccessKey: string, sessionToken: string): void {
  const header = `[${profile}]`;
  const section = [
    header,
    `aws_access_key_id=${accessKeyId}`,
    `aws_secret_access_key=${secretAccessKey}`,
    `aws_session_token=${sessionToken}`,
  ].join('\n');

  const existing = readCredentialsFile();
  const profileRegex = new RegExp(`\\[${profile}\\][^\\[]*`, 's');

  let updated: string;
  if (profileRegex.test(existing)) {
    updated = existing.replace(profileRegex, section + '\n');
  } else {
    updated = existing.trimEnd() + (existing ? '\n\n' : '') + section + '\n';
  }

  mkdirSync(join(homedir(), '.aws'), { recursive: true });
  writeFileSync(CREDENTIALS_FILE, updated, 'utf8');
}

export function registerSsoRefreshTool(server: McpServer): void {
  defineTool(
    server,
    'aws_sso_refresh',
    `Refresh AWS SSO credentials. If the SSO session is expired, triggers browser-based login. Exports credentials to the "${SSO_CRED_PROFILE}" profile in ~/.aws/credentials.`,
    {
      force: z.coerce.boolean().optional().describe('Force re-login even if session is still valid (boolean, default: false)'),
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
        // aws sso login must remain CLI — it opens an interactive browser flow
        lines.push('[LOGIN] SSO session expired or force refresh, opening browser...');
        const login = runAws(['sso', 'login', '--profile', SSO_PROFILE]);
        if (login.status !== 0) {
          return errorResult(`[ERROR] SSO login failed.\n${login.stderr}`);
        }
        lines.push('[OK] SSO login successful.');
      }

      // Resolve credentials from SSO profile using SDK
      let resolvedCreds: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
      try {
        const provider = fromIni({ profile: SSO_PROFILE });
        resolvedCreds = await provider();
      } catch (err: unknown) {
        return errorResult(
          `[ERROR] Could not resolve SSO credentials.\n${err instanceof Error ? err.message : String(err)}\nTry: aws sso login --profile ${SSO_PROFILE}`,
        );
      }

      const { accessKeyId, secretAccessKey, sessionToken = '' } = resolvedCreds;
      if (!accessKeyId || !secretAccessKey) {
        return errorResult('[ERROR] Resolved credentials are incomplete.');
      }

      // Write directly to ~/.aws/credentials INI file
      try {
        writeCredentialProfile(SSO_CRED_PROFILE, accessKeyId, secretAccessKey, sessionToken);
      } catch (err: unknown) {
        return errorResult(`[ERROR] Failed to write credentials file: ${err instanceof Error ? err.message : String(err)}`);
      }

      lines.push(`[OK] Credentials written to profile: ${SSO_CRED_PROFILE}`);

      // Verify with STS SDK call
      try {
        const sts = new STSClient({
          region: DEFAULT_REGION,
          credentials: { accessKeyId, secretAccessKey, sessionToken },
        });
        const identity = await sts.send(new GetCallerIdentityCommand({}));
        lines.push(`[OK] Verified: Account=${identity.Account} UserId=${identity.UserId} Arn=${identity.Arn}`);
      } catch (err: unknown) {
        lines.push(`[WARN] Credentials written but verification failed: ${err instanceof Error ? err.message : String(err)}`);
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
