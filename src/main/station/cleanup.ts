import type { McpServerDef } from '../types';
import type { StationState } from './types';

export interface GlobalCleanupStatus { eligible: string[]; blocked: string[]; }

export function landedGlobalIds(state: StationState): Set<string> {
  const ids = new Set<string>();
  for (const snap of Object.values(state.lastApplied)) {
    for (const id of Object.keys(snap.mcpJson)) ids.add(id);
    for (const id of Object.keys(snap.localScope)) ids.add(id);
  }
  return ids;
}

export function globalCleanupStatus(topLevelIds: string[], state: StationState): GlobalCleanupStatus {
  const landed = landedGlobalIds(state);
  const eligible: string[] = [];
  const blocked: string[] = [];
  for (const id of topLevelIds) (landed.has(id) ? eligible : blocked).push(id);
  return { eligible, blocked };
}

export function removeGlobalMcp(claudeJson: any, ids: string[]): any {
  const base = claudeJson ?? {};
  const servers: Record<string, McpServerDef> = { ...(base.mcpServers ?? {}) };
  for (const id of ids) delete servers[id];
  return { ...base, mcpServers: servers };
}
