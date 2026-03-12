import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerEcsTool } from './ecs.tool.js';
import { registerConfigureTool } from './set-profile.tool.js';
import { registerSsoStatusTool } from './sso-status.tool.js';
import { registerSsoRefreshTool } from './sso-refresh.tool.js';
import { registerJenkinsConfigureTool } from './jenkins-configure.tool.js';
import { registerJenkinsListTool } from './jenkins-list.tool.js';
import { registerJenkinsBuildTool } from './jenkins-build.tool.js';
import { registerJenkinsStatusTool } from './jenkins-status.tool.js';
import { registerJenkinsAbortTool } from './jenkins-abort.tool.js';
import { registerJenkinsEditConfigTool } from './jenkins-edit-config.tool.js';
import { registerGitCommandTool } from './git-command.tool.js';
import { registerGitWorktreeTool } from './git-worktree.tool.js';
import { registerHealthcheckTool } from './healthcheck.tool.js';
import { registerHttpRequestTool } from './http-request.tool.js';

export function registerTools(server: McpServer): void {
  registerConfigureTool(server);
  registerEcsTool(server);
  registerSsoStatusTool(server);
  registerSsoRefreshTool(server);
  registerJenkinsConfigureTool(server);
  registerJenkinsListTool(server);
  registerJenkinsBuildTool(server);
  registerJenkinsStatusTool(server);
  registerJenkinsAbortTool(server);
  registerJenkinsEditConfigTool(server);
  registerGitCommandTool(server);
  registerGitWorktreeTool(server);
  registerHealthcheckTool(server);
  registerHttpRequestTool(server);
}
