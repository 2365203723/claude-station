import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildState } from '../../src/main/scanner/buildState';

let home: string;
let proj: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'cs-home-'));
  proj = join(home, 'ecc');
  mkdirSync(join(home, '.claude', 'skills', 'graphify'), { recursive: true });
  writeFileSync(join(home, '.claude', 'skills', 'graphify', 'SKILL.md'), '# graphify');
  mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
  mkdirSync(join(proj, '.claude', 'skills', 'localskill'), { recursive: true });
  writeFileSync(join(proj, '.claude', 'skills', 'localskill', 'SKILL.md'), '# localskill');

  writeFileSync(join(home, '.claude.json'), JSON.stringify({
    mcpServers: { firecrawl: { command: 'npx', env: { K: 'v' } } },
    projects: {
      [proj]: { mcpServers: { plocal: { command: 'p' } }, disabledMcpServers: [] },
    },
  }));
  writeFileSync(join(proj, '.mcp.json'), JSON.stringify({
    mcpServers: { exa: { command: 'exa' } },
  }));
  writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
    plugins: { 'superpowers@claude-plugins-official': [{ version: '5.1.0' }] },
  }));
  writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({
    enabledPlugins: { 'superpowers@claude-plugins-official': true },
  }));
});

afterEach(() => rmSync(home, { recursive: true, force: true }));

describe('buildState', () => {
  it('infers user-scope caps', () => {
    const s = buildState(home);
    expect(s.userScope.mcp.map(m => m.id)).toEqual(['firecrawl']);
    expect(s.userScope.skills.map(k => k.id)).toEqual(['graphify']);
    expect(s.userScope.plugins[0].enabled).toBe(true);
  });

  it('infers per-project caps: .mcp.json + project-local + project skills', () => {
    const s = buildState(home);
    const p = s.projects.find(x => x.path === proj)!;
    expect(p.mcp.map(m => m.id).sort()).toEqual(['exa', 'plocal']);
    expect(p.skills.map(k => k.id)).toEqual(['localskill']);
  });

  it('excludes disabled MCP from project list', () => {
    writeFileSync(join(home, '.claude.json'), JSON.stringify({
      mcpServers: {},
      projects: { [proj]: { mcpServers: { plocal: { command: 'p' } }, disabledMcpServers: ['plocal'] } },
    }));
    const s = buildState(home);
    const p = s.projects.find(x => x.path === proj)!;
    expect(p.mcp.map(m => m.id)).toEqual(['exa']); // plocal 被禁用,剔除
  });

  it('excludes disabled MCP coming from .mcp.json too', () => {
    writeFileSync(join(home, '.claude.json'), JSON.stringify({
      mcpServers: {},
      projects: { [proj]: { mcpServers: {}, disabledMcpServers: ['exa'] } },
    }));
    const s = buildState(home);
    const p = s.projects.find(x => x.path === proj)!;
    expect(p.mcp.map(m => m.id)).toEqual([]); // exa from .mcp.json is disabled
  });
});
