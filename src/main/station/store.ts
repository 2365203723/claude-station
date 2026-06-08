import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import type { StationState } from './types';
import { stationPaths } from './paths';

export function emptyState(): StationState {
  return { version: 1, library: { mcp: {}, skills: {}, plugins: {}, snippets: {} }, assignments: {}, lastApplied: {} };
}

export function loadState(home: string = homedir()): StationState {
  const { stateFile } = stationPaths(home);
  if (!existsSync(stateFile)) return emptyState();
  try {
    const raw = JSON.parse(readFileSync(stateFile, 'utf8'));
    // 向后兼容:旧 state.json 可能没有 skills/plugins/snippets 字段
    raw.library ??= {};
    raw.library.skills ??= {};
    raw.library.plugins ??= {};
    raw.library.snippets ??= {};
    for (const a of Object.values(raw.assignments ?? {}) as any[]) {
      a.skills ??= [];
      a.plugins ??= [];
      a.snippets ??= [];
    }
    for (const s of Object.values(raw.lastApplied ?? {}) as any[]) {
      s.skills ??= [];
      s.plugins ??= [];
      s.snippets ??= [];
    }
    return raw;
  } catch { return emptyState(); }
}

export function saveState(state: StationState, home: string = homedir()): void {
  const { stateFile } = stationPaths(home);
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}
