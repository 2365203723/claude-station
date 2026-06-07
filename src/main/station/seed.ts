import type { InferredState } from '../types';
import type { StationState } from './types';

export function seedStateFromInferred(inferred: InferredState): StationState {
  const library: StationState['library'] = { mcp: {} };
  for (const m of inferred.userScope.mcp) {
    library.mcp[m.id] = { id: m.id, def: m.def, hasSecrets: m.hasSecrets };
  }
  const assignments: StationState['assignments'] = {};
  for (const p of inferred.projects) {
    for (const m of p.mcp) {
      if (!library.mcp[m.id]) library.mcp[m.id] = { id: m.id, def: m.def, hasSecrets: m.hasSecrets };
    }
    assignments[p.path] = { mcp: p.mcp.map(m => m.id) };
  }
  return { version: 1, library, assignments, lastApplied: {} };
}
