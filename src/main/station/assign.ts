import type { StationState } from './types';

export function assignMcp(state: StationState, projectPath: string, mcpId: string): StationState {
  if (!state.library.mcp[mcpId]) return state;
  const current = state.assignments[projectPath]?.mcp ?? [];
  if (current.includes(mcpId)) return state;
  return {
    ...state,
    assignments: {
      ...state.assignments,
      [projectPath]: { ...state.assignments[projectPath], mcp: [...current, mcpId] },
    },
  };
}

export function unassignMcp(state: StationState, projectPath: string, mcpId: string): StationState {
  const current = state.assignments[projectPath]?.mcp ?? [];
  return {
    ...state,
    assignments: {
      ...state.assignments,
      [projectPath]: { ...state.assignments[projectPath], mcp: current.filter(id => id !== mcpId) },
    },
  };
}

export function assignSkill(state: StationState, projectPath: string, skillId: string): StationState {
  if (!state.library.skills[skillId]) return state;
  const current = state.assignments[projectPath]?.skills ?? [];
  if (current.includes(skillId)) return state;
  return {
    ...state,
    assignments: {
      ...state.assignments,
      [projectPath]: { ...state.assignments[projectPath], skills: [...current, skillId] },
    },
  };
}

export function unassignSkill(state: StationState, projectPath: string, skillId: string): StationState {
  const current = state.assignments[projectPath]?.skills ?? [];
  return {
    ...state,
    assignments: {
      ...state.assignments,
      [projectPath]: { ...state.assignments[projectPath], skills: current.filter(id => id !== skillId) },
    },
  };
}

export function assignPlugin(state: StationState, projectPath: string, pluginId: string): StationState {
  if (!state.library.plugins[pluginId]) return state;
  const current = state.assignments[projectPath]?.plugins ?? [];
  if (current.includes(pluginId)) return state;
  return {
    ...state,
    assignments: {
      ...state.assignments,
      [projectPath]: { ...state.assignments[projectPath], plugins: [...current, pluginId] },
    },
  };
}

export function unassignPlugin(state: StationState, projectPath: string, pluginId: string): StationState {
  const current = state.assignments[projectPath]?.plugins ?? [];
  return {
    ...state,
    assignments: {
      ...state.assignments,
      [projectPath]: { ...state.assignments[projectPath], plugins: current.filter(id => id !== pluginId) },
    },
  };
}

export function assignSnippet(state: StationState, projectPath: string, snippetId: string): StationState {
  if (!state.library.snippets[snippetId]) return state;
  const current = state.assignments[projectPath]?.snippets ?? [];
  if (current.includes(snippetId)) return state;
  return {
    ...state,
    assignments: {
      ...state.assignments,
      [projectPath]: { ...state.assignments[projectPath], snippets: [...current, snippetId] },
    },
  };
}

export function unassignSnippet(state: StationState, projectPath: string, snippetId: string): StationState {
  const current = state.assignments[projectPath]?.snippets ?? [];
  return {
    ...state,
    assignments: {
      ...state.assignments,
      [projectPath]: { ...state.assignments[projectPath], snippets: current.filter(id => id !== snippetId) },
    },
  };
}
