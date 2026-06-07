import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeApply } from '../../src/main/station/apply';
import { emptyState, saveState, loadState } from '../../src/main/station/store';
import { projectMcpJson, resolvePaths } from '../../src/main/scanner/paths';

describe('executeApply', () => {
  it('writes .mcp.json + local scope, preserves other ~/.claude.json fields, records snapshot', () => {
    const home = mkdtempSync(join(tmpdir(), 'cs-ap-'));
    const proj = join(home, 'proj'); mkdirSync(proj, { recursive: true });
    writeFileSync(resolvePaths(home).claudeJson, JSON.stringify({
      mcpServers: { globalA: { command: 'g' } },
      projects: { [proj]: { lastCost: 7 } },
    }));
    const s = emptyState();
    s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
    s.library.mcp['firecrawl'] = { id: 'firecrawl', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true };
    s.assignments[proj] = { mcp: ['exa', 'firecrawl'] };
    saveState(s, home);

    executeApply(s, [proj], '20260608-010101', home);

    expect(JSON.parse(readFileSync(projectMcpJson(proj), 'utf8')).mcpServers).toEqual({ exa: { command: 'exa' } });
    const cj = JSON.parse(readFileSync(resolvePaths(home).claudeJson, 'utf8'));
    expect(cj.mcpServers).toEqual({ globalA: { command: 'g' } });
    expect(cj.projects[proj].lastCost).toBe(7);
    expect(cj.projects[proj].mcpServers).toEqual({ firecrawl: { command: 'npx', env: { K: 'v' } } });
    const saved = loadState(home);
    expect(saved.lastApplied[proj].mcpJson).toEqual({ exa: { command: 'exa' } });
    expect(saved.lastApplied[proj].localScope).toEqual({ firecrawl: { command: 'npx', env: { K: 'v' } } });
    expect(existsSync(join(home, '.claude-station', 'backups', '20260608-010101'))).toBe(true);
    rmSync(home, { recursive: true, force: true });
  });

  it('no changes → no write, returns state unchanged', () => {
    const home = mkdtempSync(join(tmpdir(), 'cs-ap2-'));
    const s = emptyState();
    const result = executeApply(s, ['/nonexistent'], '20260608-020202', home);
    expect(result).toEqual(s);
    rmSync(home, { recursive: true, force: true });
  });
});
