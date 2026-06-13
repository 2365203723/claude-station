import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { diagnoseDeadSkills, repairDeadSkills, removeDeadSkills } from '../../src/main/station/skillDoctor';
import { emptyState } from '../../src/main/station/store';
import { copyDirSafe } from '../../src/main/station/copyDir';

function makeSkill(dir: string, name = 'SKILL.md') {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), '# skill');
}

describe('diagnoseDeadSkills', () => {
  it('flags missing sourcePath, marks global-copy when global has a healthy copy', () => {
    const home = mkdtempSync(join(tmpdir(), 'doc-'));
    makeSkill(join(home, '.claude', 'skills', 's1')); // healthy global copy
    const s = emptyState();
    s.library.skills['s1'] = { id: 's1', name: 's1', sourcePath: join(home, '.claude-orbit', 'library', 'skills', 's1') };
    const dead = diagnoseDeadSkills(s, home);
    expect(dead).toHaveLength(1);
    expect(dead[0].fixable).toBe('global-copy');
    rmSync(home, { recursive: true, force: true });
  });

  it('marks manual when no global copy and no lock source', () => {
    const home = mkdtempSync(join(tmpdir(), 'doc2-'));
    const s = emptyState();
    s.library.skills['s1'] = { id: 's1', name: 's1', sourcePath: '/nonexistent/s1' };
    const dead = diagnoseDeadSkills(s, home);
    expect(dead[0].fixable).toBe('manual');
    rmSync(home, { recursive: true, force: true });
  });

  it('healthy skill is not reported', () => {
    const home = mkdtempSync(join(tmpdir(), 'doc3-'));
    const src = join(home, 'lib', 's1'); makeSkill(src);
    const s = emptyState();
    s.library.skills['s1'] = { id: 's1', name: 's1', sourcePath: src };
    expect(diagnoseDeadSkills(s, home)).toHaveLength(0);
    rmSync(home, { recursive: true, force: true });
  });
});

describe('repairDeadSkills (global-copy)', () => {
  it('copies global copy into Orbit library and clears the dead link', () => {
    const home = mkdtempSync(join(tmpdir(), 'doc4-'));
    makeSkill(join(home, '.claude', 'skills', 's1'));
    const s = emptyState();
    s.library.skills['s1'] = { id: 's1', name: 's1', sourcePath: join(home, '.claude-orbit', 'library', 'skills', 's1') };
    const { state, report } = repairDeadSkills(s, ['s1'], home);
    expect(report.repaired).toEqual(['s1']);
    expect(diagnoseDeadSkills(state, home)).toHaveLength(0);
    rmSync(home, { recursive: true, force: true });
  });
});

describe('removeDeadSkills (无源死链/空壳)', () => {
  it('removes empty-shell library dir, dead symlink, and all state references', async () => {
    const home = mkdtempSync(join(tmpdir(), 'rm1-'));
    const libDir = join(home, '.claude-orbit', 'library', 'skills', 'phantom');
    mkdirSync(libDir, { recursive: true }); // 空壳:无 SKILL.md
    mkdirSync(join(home, '.claude', 'skills'), { recursive: true });
    symlinkSync(libDir, join(home, '.claude', 'skills', 'phantom')); // 死链指向空壳

    const s = emptyState();
    s.library.skills['phantom'] = { id: 'phantom', name: 'phantom', sourcePath: libDir };
    s.library.bundles = { b1: { id: 'b1', name: 'b1', mcp: [], skills: ['phantom', 'keep'], plugins: [] } } as any;
    s.globalBundleApplied = { b1: { mcp: [], skills: ['phantom'], plugins: [] } };
    s.assignments['/proj'] = { mcp: [], skills: ['phantom'], plugins: [], snippets: [], bundles: [] };

    // 注入同步 trash(rmSync)避免依赖 Electron shell
    const { state, report } = await removeDeadSkills(s, ['phantom'], home, async (p) => rmSync(p, { recursive: true, force: true }));

    expect(report.removed).toEqual(['phantom']);
    expect(state.library.skills['phantom']).toBeUndefined();
    expect(state.library.bundles!['b1'].skills).toEqual(['keep']);
    expect(state.globalBundleApplied!['b1'].skills).toEqual([]);
    expect(state.assignments['/proj'].skills).toEqual([]);
    rmSync(home, { recursive: true, force: true });
  });

  it('护栏:拒绝移除含 SKILL.md 的健康 library 目录', async () => {
    const home = mkdtempSync(join(tmpdir(), 'rm2-'));
    const libDir = join(home, '.claude-orbit', 'library', 'skills', 'real');
    makeSkill(libDir); // 健康:有 SKILL.md
    // 让 diagnose 认定它不健康(sourcePath 指向别处死链),但 library 目录本身健康
    const s = emptyState();
    s.library.skills['real'] = { id: 'real', name: 'real', sourcePath: '/nonexistent/real' };
    const { report } = await removeDeadSkills(s, ['real'], home, async () => {});
    expect(report.removed).toEqual([]);
    expect(report.failed[0].reason).toContain('SKILL.md');
    rmSync(home, { recursive: true, force: true });
  });

  it('拒绝移除当前健康的 skill(不在死链列表)', async () => {
    const home = mkdtempSync(join(tmpdir(), 'rm3-'));
    const src = join(home, 'lib', 's1'); makeSkill(src);
    const s = emptyState();
    s.library.skills['s1'] = { id: 's1', name: 's1', sourcePath: src };
    const { report } = await removeDeadSkills(s, ['s1'], home, async () => {});
    expect(report.removed).toEqual([]);
    expect(report.failed[0].reason).toContain('死链列表');
    rmSync(home, { recursive: true, force: true });
  });
});

describe('copyDirSafe', () => {
  it('overwrites a self-referential (broken) symlink at dest without ELOOP', () => {
    const home = mkdtempSync(join(tmpdir(), 'doc5-'));
    const src = join(home, 'src'); makeSkill(src);
    const dest = join(home, 'dest');
    symlinkSync(dest, dest); // self-referential broken symlink
    expect(() => copyDirSafe(src, dest)).not.toThrow();
    rmSync(home, { recursive: true, force: true });
  });
});
