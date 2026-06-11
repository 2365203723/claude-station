import type { InferredState } from '../types';
import type { StationState } from './types';

export function seedStateFromInferred(inferred: InferredState): StationState {
  const library: StationState['library'] = { mcp: {}, skills: {}, plugins: {}, snippets: {}, bundles: {} };

  // 播种 MCP
  for (const m of inferred.userScope.mcp) {
    library.mcp[m.id] = { id: m.id, def: m.def, hasSecrets: m.hasSecrets };
  }

  // 播种 skills
  for (const s of inferred.userScope.skills) {
    library.skills[s.id] = { id: s.id, name: s.id, sourcePath: s.path };
  }

  // 播种 plugins
  for (const pl of inferred.userScope.plugins) {
    library.plugins[pl.id] = { id: pl.id };
  }

  const assignments: StationState['assignments'] = {};
  for (const p of inferred.projects) {
    // MCP
    for (const m of p.mcp) {
      if (!library.mcp[m.id]) library.mcp[m.id] = { id: m.id, def: m.def, hasSecrets: m.hasSecrets };
    }
    // skills
    for (const s of p.skills) {
      if (!library.skills[s.id]) library.skills[s.id] = { id: s.id, name: s.id, sourcePath: s.path };
    }
    // plugins
    for (const pl of p.plugins) {
      if (!library.plugins[pl.id]) library.plugins[pl.id] = { id: pl.id };
    }

    assignments[p.path] = {
      mcp: p.mcp.map(m => m.id),
      skills: p.skills.map(s => s.id),
      plugins: p.plugins.filter(pl => pl.enabled).map(pl => pl.id),
      snippets: [],
      bundles: [],
    };
  }
  return { version: 1, library, assignments, lastApplied: {} };
}
