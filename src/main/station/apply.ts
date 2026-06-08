import { readFileSync, writeFileSync, existsSync, mkdirSync, symlinkSync, unlinkSync, lstatSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ApplyPlan, FileChange, StationState, AppliedSnapshot } from './types';
import { compileProjectTargets } from './compile';
import { diffServers } from './diff';
import { projectMcpJson, resolvePaths, projectSettings, projectSkillsDir } from '../scanner/paths';
import { backupFiles } from './backup';
import { mergeMcpJson, mergeLocalScope, mergePluginSettings, mergeSnippetClaudeMd, mergeSnippetSettings } from './merge';
import { saveState } from './store';

function mcpChange(file: string, kind: FileChange['kind'], before: any, after: any): FileChange | null {
  const d = diffServers(before, after);
  if (!d.added.length && !d.removed.length && !d.changed.length) return null;
  return { file, kind, before, after, added: d.added, removed: d.removed, changed: d.changed };
}

function listChange(file: string, kind: FileChange['kind'], before: string[], after: string[]): FileChange | null {
  const added = after.filter(x => !before.includes(x));
  const removed = before.filter(x => !after.includes(x));
  if (!added.length && !removed.length) return null;
  return { file, kind, before, after, added, removed, changed: [] };
}

function jsonChange(file: string, kind: FileChange['kind'], before: any, after: any): FileChange | null {
  if (JSON.stringify(before) === JSON.stringify(after)) return null;
  const bk = Object.keys(before ?? {}), ak = Object.keys(after ?? {});
  const added = ak.filter(k => !(k in (before ?? {})));
  const removed = bk.filter(k => !(k in (after ?? {})));
  const changed = ak.filter(k => k in (before ?? {}) && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  return { file, kind, before, after, added, removed, changed };
}

function textChange(file: string, kind: FileChange['kind'], before: string, after: string): FileChange | null {
  if (before === after) return null;
  return { file, kind, before, after, added: [], removed: [], changed: ['content'] };
}

export function computeApplyPlan(state: StationState, projectPaths: string[], home: string = homedir()): ApplyPlan {
  const claudeJson = resolvePaths(home).claudeJson;
  const changes: FileChange[] = [];
  for (const path of projectPaths) {
    const target = compileProjectTargets(state, path);
    const snap: AppliedSnapshot = state.lastApplied[path] ?? { mcpJson: {}, localScope: {}, skills: [], plugins: [], snippets: [] };

    // MCP
    const mj = mcpChange(projectMcpJson(path), 'mcpjson', snap.mcpJson, target.mcpJson);
    const ls = mcpChange(claudeJson, 'localscope', snap.localScope, target.localScope);
    if (mj) changes.push(mj);
    if (ls) changes.push(ls);

    // Skills
    const targetSkillIds = target.skills.map(s => s.id);
    const sk = listChange(projectSkillsDir(path), 'skills', snap.skills, targetSkillIds);
    if (sk) changes.push(sk);

    // Plugins → settings.json
    const targetPlugins = Object.keys(target.enabledPlugins).sort();
    const pk = listChange(projectSettings(path), 'settings', snap.plugins, targetPlugins);
    if (pk) changes.push(pk);

    // Snippets → CLAUDE.md
    const claudeMdBlocks = target.snippetBlocks.filter(b => b.kind === 'claudemd');
    const snippetClaudeMdIds = claudeMdBlocks.map(b => b.id);
    const sm = listChange(join(path, 'CLAUDE.md'), 'claudemd', snap.snippets.filter(id => target.snippetBlocks.some(b => b.id === id && b.kind === 'claudemd')), snippetClaudeMdIds);
    if (sm) changes.push(sm);

    // Snippets → settings.json (hooks + env)
    const settingBlocks = target.snippetBlocks.filter(b => b.kind === 'hooks' || b.kind === 'env');
    const snippetSettingIds = settingBlocks.map(b => b.id);
    const ss = listChange(projectSettings(path), 'settings', snap.snippets.filter(id => target.snippetBlocks.some(b => b.id === id && (b.kind === 'hooks' || b.kind === 'env'))), snippetSettingIds);
    if (ss) changes.push(ss);
  }
  return { changes };
}

function readJson(file: string): any {
  if (!existsSync(file)) return undefined;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return undefined; }
}

function readText(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  try { return readFileSync(file, 'utf8'); } catch { return undefined; }
}

export function executeApply(state: StationState, projectPaths: string[], stamp: string, home: string = homedir()): StationState {
  const claudeJson = resolvePaths(home).claudeJson;
  const plan = computeApplyPlan(state, projectPaths, home);
  if (!plan.changes.length) return state;

  backupFiles([...new Set(plan.changes.map(c => c.file))], stamp, home);

  let cj = readJson(claudeJson);
  let cjDirty = false;
  const next = { ...state, lastApplied: { ...state.lastApplied } };
  for (const path of projectPaths) {
    const target = compileProjectTargets(state, path);
    const prevSnap: AppliedSnapshot = state.lastApplied[path] ?? { mcpJson: {}, localScope: {}, skills: [], plugins: [], snippets: [] };

    // MCP
    const mjDiff = diffServers(prevSnap.mcpJson, target.mcpJson);
    const lsDiff = diffServers(prevSnap.localScope, target.localScope);
    if (mjDiff.added.length || mjDiff.removed.length || mjDiff.changed.length) {
      const mcpJsonFile = projectMcpJson(path);
      mkdirSync(dirname(mcpJsonFile), { recursive: true });
      writeFileSync(mcpJsonFile, JSON.stringify(mergeMcpJson(readJson(mcpJsonFile), target.mcpJson), null, 2));
    }
    if (lsDiff.added.length || lsDiff.removed.length || lsDiff.changed.length) {
      cj = mergeLocalScope(cj, path, target.localScope);
      cjDirty = true;
    }

    // Skills — symlink
    const targetSkillIds = target.skills.map(s => s.id);
    const skillChanged = targetSkillIds.sort().join(',') !== [...prevSnap.skills].sort().join(',');
    if (skillChanged) {
      const skillsDir = projectSkillsDir(path);
      mkdirSync(skillsDir, { recursive: true });
      // 移除不再 assigned 的 symlink
      for (const id of prevSnap.skills) {
        if (!targetSkillIds.includes(id)) {
          const linkPath = join(skillsDir, id);
          try {
            if (lstatSync(linkPath).isSymbolicLink()) unlinkSync(linkPath);
          } catch { /* 文件不存在,跳过 */ }
        }
      }
      // 创建新 assigned 的 symlink
      for (const s of target.skills) {
        const linkPath = join(skillsDir, s.id);
        if (!existsSync(linkPath)) {
          symlinkSync(s.sourcePath, linkPath, 'dir');
        }
      }
    }

    // Plugins → settings.json
    const targetPluginIds = Object.keys(target.enabledPlugins).sort();
    const pluginChanged = targetPluginIds.join(',') !== [...prevSnap.plugins].sort().join(',');
    if (pluginChanged) {
      const settingsFile = projectSettings(path);
      mkdirSync(dirname(settingsFile), { recursive: true });
      writeFileSync(settingsFile, JSON.stringify(mergePluginSettings(readJson(settingsFile), target.enabledPlugins), null, 2));
    }

    // Snippets
    const snippetChanged = target.snippetBlocks.map(b => b.id).sort().join(',') !== [...prevSnap.snippets].sort().join(',');
    if (snippetChanged) {
      // CLAUDE.md
      const claudeMdBlocks = target.snippetBlocks.filter(b => b.kind === 'claudemd');
      const claudeMdPath = join(path, 'CLAUDE.md');
      const newMd = mergeSnippetClaudeMd(readText(claudeMdPath), claudeMdBlocks);
      if (newMd !== null) {
        writeFileSync(claudeMdPath, newMd);
      } else if (existsSync(claudeMdPath)) {
        // 所有 snippet 块被移除,清除残留标记后的空文件
        const existing = readText(claudeMdPath) ?? '';
        if (existing.trim() === '') {
          try { unlinkSync(claudeMdPath); } catch { /* ok */ }
        } else {
          writeFileSync(claudeMdPath, existing.trimEnd() + '\n');
        }
      }

      // settings.json (hooks + env)
      const settingBlocks = target.snippetBlocks.filter(b => b.kind === 'hooks' || b.kind === 'env');
      if (settingBlocks.length > 0) {
        const settingsFile = projectSettings(path);
        mkdirSync(dirname(settingsFile), { recursive: true });
        writeFileSync(settingsFile, JSON.stringify(mergeSnippetSettings(readJson(settingsFile), settingBlocks), null, 2));
      }
    }

    next.lastApplied[path] = {
      mcpJson: target.mcpJson,
      localScope: target.localScope,
      skills: targetSkillIds,
      plugins: targetPluginIds,
      snippets: target.snippetBlocks.map(b => b.id),
    };
  }

  if (cjDirty) writeFileSync(claudeJson, JSON.stringify(cj, null, 2));

  saveState(next, home);
  return next;
}
