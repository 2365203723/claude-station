import type { McpServerDef } from '../types';

export function mergeMcpJson(
  existing: any,
  servers: Record<string, McpServerDef>,
): any {
  return { ...(existing ?? {}), mcpServers: servers };
}

export function mergeLocalScope(
  existing: any,
  projectPath: string,
  servers: Record<string, McpServerDef>,
): any {
  const base = existing ?? {};
  const projects = { ...(base.projects ?? {}) };
  const proj = { ...(projects[projectPath] ?? {}) };
  proj.mcpServers = servers;
  projects[projectPath] = proj;
  return { ...base, projects };
}
