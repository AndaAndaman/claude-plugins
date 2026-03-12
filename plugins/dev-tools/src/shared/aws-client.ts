import { fromIni } from '@aws-sdk/credential-providers';
import { ECSClient } from '@aws-sdk/client-ecs';
import { ResourceGroupsTaggingAPIClient, GetResourcesCommand } from '@aws-sdk/client-resource-groups-tagging-api';
import { STSClient } from '@aws-sdk/client-sts';
import { getProfile } from './config.js';

export const DEFAULT_REGION = 'ap-southeast-1';

let _cachedProfile: string | undefined;
let _ecs: ECSClient | undefined;
let _tagging: ResourceGroupsTaggingAPIClient | undefined;
let _sts: STSClient | undefined;

function getClientOptions() {
  const profile = getProfile();
  if (profile !== _cachedProfile) {
    _cachedProfile = profile;
    _ecs = undefined;
    _tagging = undefined;
    _sts = undefined;
  }
  return { region: DEFAULT_REGION, credentials: fromIni({ profile }) };
}

export function ecsClient(): ECSClient {
  return _ecs ??= new ECSClient(getClientOptions());
}

export function taggingClient(): ResourceGroupsTaggingAPIClient {
  return _tagging ??= new ResourceGroupsTaggingAPIClient(getClientOptions());
}

export function stsClient(): STSClient {
  return _sts ??= new STSClient(getClientOptions());
}

/** Parse an ECS service ARN into cluster and service names. */
export function parseEcsArn(arn: string): { cluster: string; service: string } | null {
  const parts = arn.split('/');
  const cluster = parts[1];
  const service = parts[2];
  return cluster && service ? { cluster, service } : null;
}

/**
 * Fetch all ECS service ARNs matching a tag key/value, handling pagination.
 */
export async function getServiceArnsByTag(tagKey: string, tagValue: string): Promise<string[]> {
  const client = taggingClient();
  const arns: string[] = [];
  let paginationToken: string | undefined;

  do {
    const response = await client.send(new GetResourcesCommand({
      ResourceTypeFilters: ['ecs:service'],
      TagFilters: [{ Key: tagKey, Values: [tagValue] }],
      ...(paginationToken ? { PaginationToken: paginationToken } : {}),
    }));
    for (const r of response.ResourceTagMappingList ?? []) {
      if (r.ResourceARN) arns.push(r.ResourceARN);
    }
    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return arns;
}

/**
 * Returns a user-friendly error message for AWS SDK errors.
 * Detects auth/token expiry errors and prompts to run aws_sso_refresh.
 */
export function formatAwsError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const isAuthError = /ExpiredToken|InvalidClientTokenId|AuthFailure|TokenRefreshRequired|UnauthorizedAccess|CredentialsProviderError|ExpiredTokenException/i.test(msg + name);
  if (isAuthError) {
    return `SSO credentials expired. Run aws_sso_refresh.`;
  }
  return `Error: ${msg}`;
}

/** Split an array into chunks of at most `size` elements. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
