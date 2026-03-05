/**
 * MCP Tools Registry — registers all dev-tools with the server.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCreatePrTool } from './create-pr.tool.js';
import { registerJenkinsBuildTool } from './jenkins-build.tool.js';

export function registerTools(server: McpServer): void {
  registerCreatePrTool(server);
  registerJenkinsBuildTool(server);
}
