import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerEcsListTool } from './ecs-list.tool.js';
import { registerEcsScaleTool } from './ecs-scale.tool.js';
import { registerEcsUpdateServiceTool } from './ecs-update-service.tool.js';
import { registerConfigureTool } from './set-profile.tool.js';
import { registerSsoStatusTool } from './sso-status.tool.js';
import { registerSsoRefreshTool } from './sso-refresh.tool.js';
import { registerJenkinsConfigureTool } from './jenkins-configure.tool.js';
import { registerJenkinsListTool } from './jenkins-list.tool.js';
import { registerJenkinsBuildTool } from './jenkins-build.tool.js';
import { registerJenkinsStatusTool } from './jenkins-status.tool.js';

export function registerTools(server: McpServer): void {
  registerConfigureTool(server);
  registerEcsListTool(server);
  registerEcsScaleTool(server);
  registerEcsUpdateServiceTool(server);
  registerSsoStatusTool(server);
  registerSsoRefreshTool(server);
  registerJenkinsConfigureTool(server);
  registerJenkinsListTool(server);
  registerJenkinsBuildTool(server);
  registerJenkinsStatusTool(server);
}
