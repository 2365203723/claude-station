import { describe, it, expect } from 'vitest';
import { computeApplyPlan } from '../../src/main/station/apply';
import { emptyState } from '../../src/main/station/store';
import { resolvePaths } from '../../src/main/scanner/paths';

function state() {
  const s = emptyState();
  s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
  s.library.mcp['firecrawl'] = { id: 'firecrawl', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true };
  s.assignments['/p'] = { mcp: ['exa', 'firecrawl'], skills: [], plugins: [], snippets: [], bundles: [] };
  return s;
}

describe('computeApplyPlan', () => {
  it('produces only localscope changes for a fresh project (all MCP → local scope)', () => {
    const plan = computeApplyPlan(state(), ['/p'], '/home');
    expect(plan.changes.find(c => c.kind === 'mcpjson')).toBeUndefined();
    const ls = plan.changes.find(c => c.kind === 'localscope')!;
    expect(ls.file).toBe(resolvePaths('/home').claudeJson);
    expect(ls.added.sort()).toEqual(['exa', 'firecrawl']);
  });
  it('no changes when assignment equals lastApplied', () => {
    const s = state();
    s.lastApplied['/p'] = { mcpJson: {}, localScope: { exa: { command: 'exa' }, firecrawl: { command: 'npx', env: { K: 'v' } } }, skills: [], plugins: [], snippets: [], bundles: [] };
    const plan = computeApplyPlan(s, ['/p'], '/home');
    expect(plan.changes).toEqual([]);
  });
});
