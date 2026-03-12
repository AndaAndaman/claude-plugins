import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fromIni } from '@aws-sdk/credential-providers';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { defineTool, textResult, errorResult, errMsg } from '../shared/mcp-helpers.js';
import { getSsoExpiry, runAws, SSO_PROFILE, SSO_CRED_PROFILE } from '../shared/sso.js';
import { DEFAULT_REGION } from '../shared/aws-client.js';

const CREDENTIALS_FILE = join(homedir(), '.aws', 'credentials');

function readCredentialsFile(): string {
  try {
    return readFileSync(CREDENTIALS_FILE, 'utf8');
  } catch {
    return '';
  }
}

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
    `Refresh AWS SSO credentials. If expired, triggers browser login. Exports to "${SSO_CRED_PROFILE}" in ~/.aws/credentials.`,
    {
      force: z.coerce.boolean().optional().describe('Force re-login even if session is valid (default: false)'),
    },
    async (input) => {
      const force = input.force === true;
      const expiry = getSsoExpiry();
      const isValid = expiry && (expiry.expiresEpochMs - Date.now() > 0);

      // Step 1: Login if needed
      if (!isValid || force) {
        const login = runAws(['sso', 'login', '--profile', SSO_PROFILE], true);
        if (login.status !== 0) {
          return errorResult(`SSO login failed. Run manually: aws sso login --profile ${SSO_PROFILE}`);
        }
      }

      // Step 2: Resolve credentials from SSO
      let resolvedCreds: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
      try {
        const provider = fromIni({ profile: SSO_PROFILE });
        resolvedCreds = await provider();
      } catch (err: unknown) {
        return errorResult(
          `Could not resolve SSO credentials: ${errMsg(err)}\nTry: aws sso login --profile ${SSO_PROFILE}`,
        );
      }

      const { accessKeyId, secretAccessKey, sessionToken = '' } = resolvedCreds;
      if (!accessKeyId || !secretAccessKey) {
        return errorResult('Resolved credentials are incomplete.');
      }

      // Step 3: Write to credentials file
      try {
        writeCredentialProfile(SSO_CRED_PROFILE, accessKeyId, secretAccessKey, sessionToken);
      } catch (err: unknown) {
        return errorResult(`Failed to write credentials: ${errMsg(err)}`);
      }

      // Step 4: Verify + report
      const lines: string[] = [`Credentials written to profile: ${SSO_CRED_PROFILE}`];

      try {
        const sts = new STSClient({
          region: DEFAULT_REGION,
          credentials: { accessKeyId, secretAccessKey, sessionToken },
        });
        const identity = await sts.send(new GetCallerIdentityCommand({}));
        lines.push(`Verified: Account=${identity.Account} Arn=${identity.Arn}`);
      } catch (err: unknown) {
        lines.push(`Written but verification failed: ${errMsg(err)}`);
      }

      const newExpiry = getSsoExpiry();
      if (newExpiry) {
        const remaining = newExpiry.expiresEpochMs - Date.now();
        if (remaining > 0) {
          const hrs = Math.floor(remaining / 3_600_000);
          const mins = Math.floor((remaining % 3_600_000) / 60_000);
          lines.push(`Expires: ${newExpiry.expiresAt} (${hrs}h ${mins}m remaining)`);
        }
      }

      return textResult(lines.join('\n'));
    },
  );
}
