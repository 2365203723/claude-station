import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import type { InferredState, ProjectState } from '../types';
import { resolvePaths, projectMcpJson, projectSkillsDir, projectSettings } from './paths';
import { parseClaudeJson } from './parseClaudeJson';
import { parseMcpJson } from './parseMcpJson';
import { scanSkills } from './scanSkills';
import { parsePlugins } from './parsePlugins';

function readJson(file: string): any {
  if (!existsSync(file)) return undefined;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return undefined; }
}

export function buildState(home: string = homedir()): InferredState {
  const paths = resolvePaths(home);
  const claudeJson = readJson(paths.claudeJson) ?? {};
  const cj = parseClaudeJson(claudeJson);
  const installed = readJson(paths.installedPlugins);
  const globalSettings = readJson(paths.globalSettings);

  const userScope = {
    mcp: cj.userMcp,
    skills: scanSkills(paths.globalSkillsDir, 'user'),
    plugins: parsePlugins(installed, globalSettings?.enabledPlugins),
  };

  const projects: ProjectState[] = cj.projectPaths.map(path => {
    const disabled = new Set(cj.disabledByProject[path] ?? []);
    const local = (cj.projectLocalMcp[path] ?? []).filter(m => !disabled.has(m.id));
    const fromMcpJson = parseMcpJson(projectMcpJson(path)).filter(m => !disabled.has(m.id));
    const projSettings = readJson(projectSettings(path));
    // 同一 MCP 可能同时出现在 .mcp.json 和 ~/.claude.json 本地作用域里——按 id 去重,
    // 否则星球上会画出重复卫星、assignments 里也会塞重复 id
    const seen = new Set<string>();
    const mcp = [...fromMcpJson, ...local].filter(m => seen.has(m.id) ? false : (seen.add(m.id), true));
    return {
      path,
      mcp,
      skills: scanSkills(projectSkillsDir(path), 'project'),
      plugins: parsePlugins(installed, projSettings?.enabledPlugins),
    };
  });

  return { userScope, projects };
}
