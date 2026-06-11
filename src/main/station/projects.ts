import { accessSync, constants, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import type { StationState } from './types';
import type { InferredState } from '../types';

function readJson(file: string): any {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return undefined; }
}

// 取消挂载：删除 assignments + 从 ~/.claude.json 移除项目
export function unmountProject(state: StationState, projectPath: string): StationState {
  if (!state.assignments[projectPath]) return state;
  const nextAssign = { ...state.assignments };
  delete nextAssign[projectPath];

  // 同时从 ~/.claude.json 移除项目
  const cjFile = resolve(homedir(), '.claude.json');
  const cj = readJson(cjFile) ?? {};
  if (cj.projects?.[projectPath]) {
    const proj = { ...cj.projects };
    delete proj[projectPath];
    writeFileSync(cjFile, JSON.stringify({ ...cj, projects: proj }, null, 2));
  }

  return { ...state, assignments: nextAssign };
}

// 挂载项目：写 ~/.claude.json + state.json
export function addProject(state: StationState, projectPath: string, inferred: InferredState): StationState {
  const proj = inferred.projects.find(p => p.path === projectPath);
  const mcp = (proj?.mcp ?? []).map(m => m.id);
  const skills = (proj?.skills ?? []).map(s => s.id);
  const plugins = (proj?.plugins ?? []).filter(pl => pl.enabled).map(pl => pl.id);

  // 确保项目在 ~/.claude.json 中有注册
  const cjFile = resolve(homedir(), '.claude.json');
  const cj = readJson(cjFile) ?? {};
  if (!cj.projects?.[projectPath]) {
    const proj = { ...(cj.projects ?? {}) };
    proj[projectPath] = cj.projects?.[projectPath] ?? {};
    writeFileSync(cjFile, JSON.stringify({ ...cj, projects: proj }, null, 2));
  }

  return {
    ...state,
    assignments: {
      ...state.assignments,
      [projectPath]: { mcp, skills, plugins, snippets: [], bundles: [] },
    },
  };
}

export function pathExists(absPath: string): boolean {
  try { accessSync(absPath, constants.R_OK); return true; } catch { return false; }
}
