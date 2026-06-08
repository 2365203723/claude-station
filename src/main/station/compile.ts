import type { McpServerDef } from '../types';
import type { StationState } from './types';

export interface ProjectTargets {
  mcpJson: Record<string, McpServerDef>;
  localScope: Record<string, McpServerDef>;
  skills: { id: string; sourcePath: string }[];
  enabledPlugins: Record<string, boolean>;
  snippetBlocks: { id: string; kind: string; content: string }[];
}

export function compileProjectTargets(state: StationState, projectPath: string): ProjectTargets {
  const assignment = state.assignments[projectPath];

  // MCP
  const ids = assignment?.mcp ?? [];
  const mcpJson: Record<string, McpServerDef> = {};
  const localScope: Record<string, McpServerDef> = {};
  for (const id of ids) {
    const entry = state.library.mcp[id];
    if (!entry) continue;
    if (entry.hasSecrets) localScope[id] = entry.def;
    else mcpJson[id] = entry.def;
  }

  // Skills
  const skillIds = assignment?.skills ?? [];
  const skills: { id: string; sourcePath: string }[] = [];
  for (const id of skillIds) {
    const entry = state.library.skills[id];
    if (!entry) continue;
    skills.push({ id: entry.id, sourcePath: entry.sourcePath });
  }

  // Plugins
  const pluginIds = assignment?.plugins ?? [];
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
