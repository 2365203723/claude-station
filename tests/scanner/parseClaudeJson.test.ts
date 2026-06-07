import { describe, it, expect } from 'vitest';
import { parseClaudeJson } from '../../src/main/scanner/parseClaudeJson';

describe('parseClaudeJson', () => {
  const raw = {
    mcpServers: {
      firecrawl: { command: 'npx', args: ['-y', 'fc'], env: { FIRECRAWL_API_KEY: 'sk-real' } },
      codegraph: { type: 'stdio', command: 'codegraph', args: ['serve'] },
    },
    projects: {
      '/Users/x/ecc': { mcpServers: { local1: { command: 'foo' } }, disabledMcpServers: ['firecrawl'] },
      '/Users/x/web': {},
    },
  };

  it('extracts user-scope MCP with hasSecrets flag', () => {
    const r = parseClaudeJson(raw);
    expect(r.userMcp.map(m => m.id).sort()).toEqual(['codegraph', 'firecrawl']);
    const fc = r.userMcp.find(m => m.id === 'firecrawl')!;
    expect(fc.scope).toBe('user');
    expect(fc.hasSecrets).toBe(true);   // env 有值
    const cg = r.userMcp.find(m => m.id === 'codegraph')!;
    expect(cg.hasSecrets).toBe(false);  // 无 env
  });

  it('lists project paths', () => {
    const r = parseClaudeJson(raw);
    expect(r.projectPaths.sort()).toEqual(['/Users/x/ecc', '/Users/x/web']);
  });

  it('extracts project-local MCP and disabled list per project', () => {
    const r = parseClaudeJson(raw);
    expect(r.projectLocalMcp['/Users/x/ecc'].map(m => m.id)).toEqual(['local1']);
    expect(r.projectLocalMcp['/Users/x/ecc'][0].scope).toBe('project-local');
    expect(r.disabledByProject['/Users/x/ecc']).toEqual(['firecrawl']);
  });

  it('handles missing keys gracefully', () => {
    const r = parseClaudeJson({});
    expect(r.userMcp).toEqual([]);
    expect(r.projectPaths).toEqual([]);
  });
});
