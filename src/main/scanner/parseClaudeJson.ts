import type { McpCapability, McpServerDef } from '../types';

export interface ClaudeJsonResult {
  userMcp: McpCapability[];
  projectPaths: string[];
  projectLocalMcp: Record<string, McpCapability[]>;
  disabledByProject: Record<string, string[]>;
}

function hasSecrets(def: McpServerDef): boolean {
  return !!def.env && Object.values(def.env).some(v => typeof v === 'string' && v.length > 0);
}

function toCaps(
  servers: Record<string, McpServerDef> | undefined,
  scope: McpCapability['scope'],
): McpCapability[] {
  if (!servers) return [];
  return Object.entries(servers).map(([id, def]) => ({
    id, scope, def, hasSecrets: hasSecrets(def),
  }));
}

export function parseClaudeJson(raw: any): ClaudeJsonResult {
  const userMcp = toCaps(raw?.mcpServers, 'user');
  const projects = raw?.projects ?? {};
  const projectPaths = Object.keys(projects);
  const projectLocalMcp: Record<string, McpCapability[]> = {};
  const disabledByProject: Record<string, string[]> = {};
  for (const [path, p] of Object.entries<any>(projects)) {
    projectLocalMcp[path] = toCaps(p?.mcpServers, 'project-local');
    disabledByProject[path] = Array.isArray(p?.disabledMcpServers) ? p.disabledMcpServers : [];
  }
  return { userMcp, projectPaths, projectLocalMcp, disabledByProject };
}
