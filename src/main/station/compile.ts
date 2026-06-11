import type { McpServerDef } from '../types';
import type { StationState } from './types';
import { expandProjectBundles } from './bundles';

export interface ProjectTargets {
  mcpJson: Record<string, McpServerDef>;
  localScope: Record<string, McpServerDef>;
  skills: { id: string; sourcePath: string }[];
  enabledPlugins: Record<string, boolean>;
  snippetBlocks: { id: string; kind: string; content: string }[];
}

export function compileProjectTargets(state: StationState, projectPath: string): ProjectTargets {
  const assignment = state.assignments[projectPath];
  const expanded = expandProjectBundles(state, projectPath);

  // MCP: 个体分配 + bundle 展开的 MCP
  // 全部走 local scope(~/.claude.json 按完整路径精确匹配),不写 .mcp.json。
  // 原因:.mcp.json 会被子目录继承,无法隔离嵌套项目(如 home 目录套着子项目);
  // local scope 路径精确,父子目录都不会泄漏。mcpJson 恒为空,保留字段是为了
  // 兼容快照结构与"清空遗留 .mcp.json"的对比逻辑。
  const ids = new Set<string>(assignment?.mcp ?? []);
  expanded.mcpIds.forEach(id => ids.add(id));
  const mcpJson: Record<string, McpServerDef> = {};
  const localScope: Record<string, McpServerDef> = {};
  for (const id of ids) {
    const entry = state.library.mcp[id];
    if (!entry) continue;
    localScope[id] = entry.def;
  }

  // Skills: 个体分配 + bundle 展开的 skills
  const skillIds = new Set<string>(assignment?.skills ?? []);
  expanded.skillIds.forEach(id => skillIds.add(id));
  const skills: { id: string; sourcePath: string }[] = [];
  for (const id of skillIds) {
    const entry = state.library.skills[id];
    if (!entry) continue;
    skills.push({ id: entry.id, sourcePath: entry.sourcePath });
  }

  // Plugins: 个体分配 + bundle 展开的 plugins
  const pluginIds = new Set<string>(assignment?.plugins ?? []);
  expanded.pluginIds.forEach(id => pluginIds.add(id));
  const enabledPlugins: Record<string, boolean> = {};
  for (const id of pluginIds) {
    enabledPlugins[id] = true;
  }

  // Snippets
  const snippetIds = assignment?.snippets ?? [];
  const snippetBlocks: { id: string; kind: string; content: string }[] = [];
  for (const id of snippetIds) {
    const entry = state.library.snippets[id];
    if (!entry) continue;
    snippetBlocks.push({ id: entry.id, kind: entry.kind, content: entry.content });
  }

  return { mcpJson, localScope, skills, enabledPlugins, snippetBlocks };
}
