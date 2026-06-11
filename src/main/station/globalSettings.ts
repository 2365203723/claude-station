import { readFileSync, writeFileSync, existsSync, mkdirSync, symlinkSync, unlinkSync, rmdirSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import type { McpServerDef } from '../types';
import type { StationState, LibraryBundle } from './types';

function readJson(file: string): any {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return undefined; }
}
function saveJson(file: string, data: any): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
}

const home = homedir();
const claudeJsonFile = resolve(home, '.claude.json');
const skillsDir = resolve(home, '.claude', 'skills');
const settingsFile = resolve(home, '.claude', 'settings.json');

// ==================== Global MCP — 直接写 ~/.claude.json ====================
export interface GlobalMcpInfo { id: string; def: McpServerDef; hasSecrets: boolean; }
export function listGlobalMcp(): GlobalMcpInfo[] {
  const cj = readJson(claudeJsonFile) ?? {};
  const servers = cj.mcpServers ?? {};
  return Object.entries(servers).map(([id, def]) => {
    const d = def as McpServerDef;
    return { id, def: d, hasSecrets: !!(d.env && Object.values(d.env).some((v: any) => typeof v === 'string' && v.length > 0)) };
  });
}
export function addGlobalMcp(id: string, def: McpServerDef): void {
  const cj = readJson(claudeJsonFile) ?? {};
  const servers = cj.mcpServers ?? {};
  if (servers[id]) return;
  servers[id] = def;
  saveJson(claudeJsonFile, { ...cj, mcpServers: servers });
}
export function removeGlobalMcp(id: string): void {
  const cj = readJson(claudeJsonFile) ?? {};
  const servers = cj.mcpServers ?? {};
  delete servers[id];
  saveJson(claudeJsonFile, { ...cj, mcpServers: servers });
}

// ==================== Global Skills — 直接操作 ~/.claude/skills/ ====================
export interface GlobalSkillInfo { id: string; isSymlink: boolean; }
export function listGlobalSkills(): GlobalSkillInfo[] {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() || e.isSymbolicLink())
    .map(e => ({ id: e.name, isSymlink: e.isSymbolicLink() }));
}
export function addGlobalSkill(id: string, sourcePath?: string): void {
  mkdirSync(skillsDir, { recursive: true });
  const target = join(skillsDir, id);
  try { if (lstatSync(target)) return; } catch { /* 不存在,继续 */ }
  if (sourcePath) {
    // sourcePath 可能已经指向全局 skills 目录本身(scanSkills 扫描的就是这里),
    // 再建 symlink 会变成自指死链。已存在、或已在全局 skills 里就不用动。
    if (resolve(sourcePath) === resolve(target)) return;
    symlinkSync(resolve(sourcePath), target, 'dir');
  } else {
    mkdirSync(target, { recursive: true });
  }
}
export function removeGlobalSkill(id: string): void {
  const target = join(skillsDir, id);
  try {
    const st = lstatSync(target);
    if (st.isSymbolicLink()) unlinkSync(target);
    else rmdirSync(target, { recursive: true });
  } catch { /* 不存在就什么都不做 */ }
}

// ==================== Global Plugins — 直接操作 settings.json ====================
export interface GlobalPluginInfo { id: string; enabled: boolean; }
export function listGlobalPlugins(): GlobalPluginInfo[] {
  const installedFile = resolve(home, '.claude', 'plugins', 'installed_plugins.json');
  const installed = readJson(installedFile);
  const settings = readJson(settingsFile) ?? {};
  const enabledPlugins: Record<string, boolean> = settings.enabledPlugins ?? {};
  const plugins = installed?.plugins ?? {};
  return Object.keys(plugins).map(id => ({ id, enabled: enabledPlugins[id] === true }));
}
export function addGlobalPlugin(id: string): void {
  const settings = readJson(settingsFile) ?? {};
  const ep = { ...(settings.enabledPlugins ?? {}) };
  ep[id] = true;
  saveJson(settingsFile, { ...settings, enabledPlugins: ep });
}
export function removeGlobalPlugin(id: string): void {
  const settings = readJson(settingsFile) ?? {};
  const ep = { ...(settings.enabledPlugins ?? {}) };
  delete ep[id];
  saveJson(settingsFile, { ...settings, enabledPlugins: ep });
}

// ==================== Global Bundle 分配（展开为个体 MCP/Skill/Plugin） ====================
export function assignGlobalBundle(state: StationState, bundleId: string): void {
  const b = state.library.bundles[bundleId];
  if (!b) return;
  for (const mcpId of b.mcp) {
    const entry = state.library.mcp[mcpId];
    if (entry) addGlobalMcp(mcpId, entry.def);
  }
  for (const skillId of b.skills) {
    const entry = state.library.skills[skillId];
    if (entry) addGlobalSkill(skillId, entry.sourcePath);
  }
  for (const pluginId of b.plugins) {
    addGlobalPlugin(pluginId);
  }
}
export function unassignGlobalBundle(state: StationState, bundleId: string): void {
  const b = state.library.bundles[bundleId];
  if (!b) return;
  for (const mcpId of b.mcp) removeGlobalMcp(mcpId);
  for (const skillId of b.skills) removeGlobalSkill(skillId);
  for (const pluginId of b.plugins) removeGlobalPlugin(pluginId);
}
