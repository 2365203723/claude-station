import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeApply } from '../../src/main/station/apply';
import { assignMcp } from '../../src/main/station/assign';
import { emptyState, saveState } from '../../src/main/station/store';
import { buildState } from '../../src/main/scanner/buildState';
import { resolvePaths } from '../../src/main/scanner/paths';

describe('drop = apply round-trip', () => {
  it('after assign+executeApply, buildState reads capability back as inferred (applied), no dupes', () => {
    const home = mkdtempSync(join(tmpdir(), 'cs-rt-'));
    const proj = join(home, 'proj'); mkdirSync(proj, { recursive: true });
    writeFileSync(resolvePaths(home).claudeJson, JSON.stringify({ projects: { [proj]: {} } }));
    let s = emptyState();
    s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
    s.library.mcp['fc'] = { id: 'fc', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true };
    saveState(s, home);
    s = assignMcp(s, proj, 'exa'); saveState(s, home);
    s = executeApply(s, [proj], 'stamp1', home);
    s = assignMcp(s, proj, 'fc'); saveState(s, home);
    s = executeApply(s, [proj], 'stamp2', home);
    const inferred = buildState(home);
    const p = inferred.projects.find(x => x.path === proj)!;
    expect(p.mcp.map(m => m.id).sort()).toEqual(['exa', 'fc']);
    rmSync(home, { recursive: true, force: true });
  });
});
