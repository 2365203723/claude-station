import { describe, it, expect } from 'vitest';
import { computeApplyPlan } from '../../src/main/station/apply';
import { emptyState } from '../../src/main/station/store';
import { projectMcpJson, resolvePaths } from '../../src/main/scanner/paths';

function state() {
  const s = emptyState();
  s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
  s.library.mcp['firecrawl'] = { id: 'firecrawl', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true };
  s.assignments['/p'] = { mcp: ['exa', 'firecrawl'], skills: [], plugins: [], snippets: [] };
  return s;
}

describe('computeApplyPlan', () => {
  it('produces mcpjson + localscope changes for a fresh project', () => {
    const plan = computeApplyPlan(state(), ['/p'], '/home');
    const mj = plan.changes.find(c => c.kind === 'mcpjson')!;
    const ls = plan.changes.find(c => c.kind === 'localscope')!;
    expect(mj.file).toBe(projectMcpJson('/p'));
    expect(mj.added).toEqual(['exa']);
    expect(ls.file).toBe(resolvePaths('/home').claudeJson);
    expect(ls.added).toEqual(['firecrawl']);
  });
  it('no changes when assignment equals lastApplied', () => {
    const s = state();
    s.lastApplied['/p'] = { mcpJson: { exa: { command: 'exa' } }, localScope: { firecrawl: { command: 'npx', env: { K: 'v' } } }, skills: [], plugins: [], snippets: [] };
    const plan = computeApplyPlan(s, ['/p'], '/home');
    expect(plan.changes).toEqual([]);
  });
});
