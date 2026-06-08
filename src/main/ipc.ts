import { ipcMain } from 'electron';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { buildState } from './scanner/buildState';
import { loadState, saveState } from './station/store';
import { seedStateFromInferred } from './station/seed';
import { assignMcp, unassignMcp, assignSkill, unassignSkill, assignPlugin, unassignPlugin, assignSnippet, unassignSnippet } from './station/assign';
import { computeApplyPlan, executeApply } from './station/apply';
import { stationPaths } from './station/paths';
import { globalCleanupStatus, executeGlobalCleanup } from './station/cleanup';

export function registerIpc(): void {
  ipcMain.handle('station:getState', () => buildState());

  // Desired state: seed from reverse-import on first run, else read state.json.
  // 向后兼容:如果 state.json 是 M2 遗留(无 skills/plugins),从 inferred 补种。
  ipcMain.handle('station:loadDesired', () => {
    const home = homedir();
    if (!existsSync(stationPaths(home).stateFile)) {
      const seeded = seedStateFromInferred(buildState(home));
      saveState(seeded, home);
      return seeded;
    }
    const state = loadState(home);
    let dirty = false;

    // 补种 skills:如果 library.skills 为空但磁盘上有 skill,则填充
    if (Object.keys(state.library.skills).length === 0 || Object.keys(state.library.plugins).length === 0) {
      const inferred = buildState(home);
      // 补 library
      for (const s of inferred.userScope.skills) {
        if (!state.library.skills[s.id]) {
          state.library.skills[s.id] = { id: s.id, name: s.id, sourcePath: s.path };
          dirty = true;
        }
      }
      for (const pl of inferred.userScope.plugins) {
        if (!state.library.plugins[pl.id]) {
          state.library.plugins[pl.id] = { id: pl.id };
          dirty = true;
        }
      }
      // 补项目 assignments 中已有的 skills/plugins
      for (const p of inferred.projects) {
        const a = state.assignments[p.path];
        if (a && a.skills.length === 0 && p.skills.length > 0) {
          a.skills = p.skills.map(s => s.id);
          dirty = true;
        }
        if (a && a.plugins.length === 0 && p.plugins.filter(pl => pl.enabled).length > 0) {
          a.plugins = p.plugins.filter(pl => pl.enabled).map(pl => pl.id);
          dirty = true;
        }
      }
    }

    if (dirty) saveState(state, home);
    return state;
  });

  // MCP
  ipcMain.handle('station:assign', (_e, projectPath: string, mcpId: string) => {
    const next = assignMcp(loadState(), projectPath, mcpId);
    saveState(next);
    return next;
  });
  ipcMain.handle('station:unassign', (_e, projectPath: string, mcpId: string) => {
    const next = unassignMcp(loadState(), projectPath, mcpId);
    saveState(next);
    return next;
  });

  // Skills
  ipcMain.handle('station:assignSkill', (_e, projectPath: string, skillId: string) => {
    const next = assignSkill(loadState(), projectPath, skillId);
    saveState(next);
    return next;
  });
  ipcMain.handle('station:unassignSkill', (_e, projectPath: string, skillId: string) => {
    const next = unassignSkill(loadState(), projectPath, skillId);
    saveState(next);
    return next;
  });

  // Plugins
  ipcMain.handle('station:assignPlugin', (_e, projectPath: string, pluginId: string) => {
    const next = assignPlugin(loadState(), projectPath, pluginId);
    saveState(next);
    return next;
  });
  ipcMain.handle('station:unassignPlugin', (_e, projectPath: string, pluginId: string) => {
    const next = unassignPlugin(loadState(), projectPath, pluginId);
    saveState(next);
    return next;
  });

  // Snippets
  ipcMain.handle('station:assignSnippet', (_e, projectPath: string, snippetId: string) => {
    const next = assignSnippet(loadState(), projectPath, snippetId);
    saveState(next);
    return next;
  });
  ipcMain.handle('station:unassignSnippet', (_e, projectPath: string, snippetId: string) => {
    const next = unassignSnippet(loadState(), projectPath, snippetId);
    saveState(next);
    return next;
  });

  ipcMain.handle('station:plan', (_e, projectPaths: string[]) =>
    computeApplyPlan(loadState(), projectPaths));

  ipcMain.handle('station:apply', (_e, projectPaths: string[]) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return executeApply(loadState(), projectPaths, stamp);
  });

  ipcMain.handle('station:globalStatus', () => {
    const home = homedir();
    const topLevelIds = buildState(home).userScope.mcp.map(m => m.id);
    return globalCleanupStatus(topLevelIds, loadState(home));
  });

  ipcMain.handle('station:cleanupGlobal', (_e, ids: string[]) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return executeGlobalCleanup(ids, stamp);
  });
}
