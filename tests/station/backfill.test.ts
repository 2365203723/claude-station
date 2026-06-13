import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { backfillState } from '../../src/main/station/backfill';
import { emptyState } from '../../src/main/station/store';
import type { StationState } from '../../src/main/station/types';
import type { InferredState } from '../../src/main/types';

function inferred(over: Partial<InferredState['userScope']> = {}, projects: InferredState['projects'] = []): InferredState {
  return {
    userScope: { mcp: over.mcp ?? [], skills: over.skills ?? [], plugins: over.plugins ?? [] },
    projects,
  };
}

describe('backfillState', () => {
  it('does not backfill items already covered by an assigned bundle', () => {
    const s = emptyState();
    s.library.bundles['bnd'] = { id: 'bnd', name: 'B', version: '1', mcp: ['m1'], skills: ['s1'], plugins: ['p1'] };
    const proj = '/proj';
    s.assignments[proj] = { mcp: [], skills: [], plugins: [], snippets: [], bundles: ['bnd'] };
    const inf = inferred({}, [{
      path: proj,
      mcp: [{ id: 'm1', scope: 'project-local', def: { command: 'm' }, hasSecrets: false }],
      skills: [{ id: 's1', scope: 'project', path: '/x/s1' }],
      plugins: [{ id: 'p1', enabled: true }],
    }]);
    const r = backfillState(s, inf);
    const a = r.state.assignments[proj];
    expect(a.mcp).not.toContain('m1');
    expect(a.skills).not.toContain('s1');
    expect(a.plugins).not.toContain('p1');
  });

  it('adds a new non-bundle item and reports dirty', () => {
    const s = emptyState();
    const proj = '/proj';
    s.assignments[proj] = { mcp: [], skills: [], plugins: [], snippets: [], bundles: [] };
    const inf = inferred({}, [{
      path: proj,
      mcp: [{ id: 'm2', scope: 'project-local', def: { command: 'm' }, hasSecrets: false }],
      skills: [],
      plugins: [],
    }]);
    const r = backfillState(s, inf);
    expect(r.dirty).toBe(true);
    expect(r.state.assignments[proj].mcp).toContain('m2');
    expect(r.state.library.mcp['m2']).toBeUndefined(); // userScope 才补 library
  });

  it('does not backfill a disabled plugin', () => {
    const s = emptyState();
    const proj = '/proj';
    s.assignments[proj] = { mcp: [], skills: [], plugins: [], snippets: [], bundles: [] };
    const inf = inferred({}, [{
      path: proj, mcp: [], skills: [],
      plugins: [{ id: 'off', enabled: false }],
    }]);
    const r = backfillState(s, inf);
    expect(r.state.assignments[proj].plugins).not.toContain('off');
  });

  it('nothing new → dirty=false', () => {
    const s = emptyState();
    const r = backfillState(s, inferred());
    expect(r.dirty).toBe(false);
    expect(r.bundlesDetected).toBe(false);
  });

  it('backfills userScope items into library and marks dirty', () => {
    const home = mkdtempSync(join(tmpdir(), 'bf-home-'));
    const src = join(home, 'src', 's1');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'SKILL.md'), '# s1');
    const s = emptyState();
    const r = backfillState(s, inferred({
      skills: [{ id: 's1', scope: 'user', path: src }],
      plugins: [{ id: 'p1', enabled: true }],
      mcp: [{ id: 'm1', scope: 'user', def: { command: 'm' }, hasSecrets: false }],
    }), home);
    expect(r.dirty).toBe(true);
    expect(r.state.library.skills['s1'].sourcePath).toBe(join(home, '.claude-orbit', 'library', 'skills', 's1'));
    expect(r.state.library.plugins['p1']).toBeTruthy();
    expect(r.state.library.mcp['m1']).toBeTruthy();
    rmSync(home, { recursive: true, force: true });
  });

  it('does not run detectBundles when library.bundles is already non-empty', () => {
    const s = emptyState();
    s.library.bundles['existing'] = { id: 'existing', name: 'E', version: '1', mcp: [], skills: [], plugins: [] };
    // 若运行检测会基于 library.mcp/skills 生成新 bundle
    s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
    s.library.skills['exa-search'] = { id: 'exa-search', name: 'x', sourcePath: '/x' };
    const r = backfillState(s, inferred());
    expect(r.bundlesDetected).toBe(false);
    expect(Object.keys(r.state.library.bundles)).toEqual(['existing']);
  });

  it('runs detectBundles when library.bundles is empty', () => {
    const s = emptyState();
    s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
    s.library.skills['exa-search'] = { id: 'exa-search', name: 'x', sourcePath: '/x' };
    const r = backfillState(s, inferred());
    expect(r.bundlesDetected).toBe(true);
    expect(r.state.library.bundles['exa']).toBeTruthy();
  });

  it('回归:userScope skill 的 path 是指向库真身的 symlink 时,绝不清空库副本', () => {
    // 复现 bug:~/.claude/skills/<id> 是指向 ~/.claude-orbit/library/skills/<id> 的 symlink,
    // buildState 扫到它后 path=symlink。旧逻辑 sourcePath!==dest(字符串)→ copyDirSafe 先 rmSync(dest)
    // 删库真身、再从 follow 到已空 dest 的 symlink 复制 → 把自己清空。app 一打开 skill 就没了。
    const home = mkdtempSync(join(tmpdir(), 'bf-alias-'));
    const libSkill = join(home, '.claude-orbit', 'library', 'skills', 'agentmemory-agents');
    mkdirSync(libSkill, { recursive: true });
    writeFileSync(join(libSkill, 'SKILL.md'), '# real content');
    writeFileSync(join(libSkill, 'REFERENCE.md'), 'ref');
    // ~/.claude/skills/<id> symlink → 库真身
    const claudeSkills = join(home, '.claude', 'skills');
    mkdirSync(claudeSkills, { recursive: true });
    const link = join(claudeSkills, 'agentmemory-agents');
    symlinkSync(libSkill, link);

    const s = emptyState();
    s.library.skills['agentmemory-agents'] = { id: 'agentmemory-agents', name: 'agentmemory-agents', sourcePath: libSkill };

    // 模拟 reload:inferred 把 symlink 路径作为 userScope skill 的 path
    backfillState(s, inferred({ skills: [{ id: 'agentmemory-agents', scope: 'user', path: link }] }), home);

    // 库真身内容必须原样保留,绝不被清空
    expect(existsSync(join(libSkill, 'SKILL.md'))).toBe(true);
    expect(readFileSync(join(libSkill, 'SKILL.md'), 'utf8')).toBe('# real content');
    expect(existsSync(join(libSkill, 'REFERENCE.md'))).toBe(true);
    rmSync(home, { recursive: true, force: true });
  });

  it('skips a project present on disk but absent from state.assignments', () => {
    const s = emptyState();
    const inf = inferred({}, [{
      path: '/unmounted',
      mcp: [{ id: 'm1', scope: 'project-local', def: { command: 'm' }, hasSecrets: false }],
      skills: [], plugins: [],
    }]);
    const r = backfillState(s, inf);
    expect(r.dirty).toBe(false);
    expect(r.state.assignments['/unmounted']).toBeUndefined();
  });
});
