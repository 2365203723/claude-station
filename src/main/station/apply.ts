import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import type { ApplyPlan, FileChange, StationState, AppliedSnapshot } from './types';
import { compileProjectTargets } from './compile';
import { diffServers } from './diff';
import { projectMcpJson, resolvePaths } from '../scanner/paths';
import { backupFiles } from './backup';
import { mergeMcpJson, mergeLocalScope } from './merge';
import { saveState } from './store';

function change(file: string, kind: FileChange['kind'], before: any, after: any): FileChange | null {
  const d = diffServers(before, after);
  if (!d.added.length && !d.removed.length && !d.changed.length) return null;
  return { file, kind, before, after, added: d.added, removed: d.removed, changed: d.changed };
}

export function computeApplyPlan(state: StationState, projectPaths: string[], home: string = homedir()): ApplyPlan {
  const claudeJson = resolvePaths(home).claudeJson;
  const changes: FileChange[] = [];
  for (const path of projectPaths) {
    const target = compileProjectTargets(state, path);
    const snap: AppliedSnapshot = state.lastApplied[path] ?? { mcpJson: {}, localScope: {} };
    const mj = change(projectMcpJson(path), 'mcpjson', snap.mcpJson, target.mcpJson);
    const ls = change(claudeJson, 'localscope', snap.localScope, target.localScope);
    if (mj) changes.push(mj);
    if (ls) changes.push(ls);
  }
  return { changes };
}

function readJson(file: string): any {
  if (!existsSync(file)) return undefined;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return undefined; }
}

export function executeApply(state: StationState, projectPaths: string[], stamp: string, home: string = homedir()): StationState {
  const claudeJson = resolvePaths(home).claudeJson;
  const plan = computeApplyPlan(state, projectPaths, home);
  if (!plan.changes.length) return state;

  backupFiles([...new Set(plan.changes.map(c => c.file))], stamp, home);

  let cj = readJson(claudeJson);
  const next = { ...state, lastApplied: { ...state.lastApplied } };
  for (const path of projectPaths) {
    const target = compileProjectTargets(state, path);
    const mcpJsonFile = projectMcpJson(path);
    writeFileSync(mcpJsonFile, JSON.stringify(mergeMcpJson(readJson(mcpJsonFile), target.mcpJson), null, 2));
    cj = mergeLocalScope(cj, path, target.localScope);
    next.lastApplied[path] = { mcpJson: target.mcpJson, localScope: target.localScope };
  }
  writeFileSync(claudeJson, JSON.stringify(cj, null, 2));

  saveState(next, home);
  return next;
}
