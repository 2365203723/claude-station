import { existsSync, statSync, readFileSync, rmSync, mkdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { orbitPaths } from './paths';
import type { StationState } from './types';
import { saveState } from './store';
import { syncSkillIntoOrbitLibrary } from './skillLibrarySync';
import { copyDirSafe } from './copyDir';
import { cloneRepoShallow, locateSkillDir } from './installSkill';

export interface DeadSkill {
  id: string;
  sourcePath: string;
  /** lock 文件记录的 Git 来源(若有) */
  sourceUrl?: string;
  /** 仓库内 SKILL.md 相对路径 */
  skillPath?: string;
  /** 全局是否还有健康副本可直接复制 */
  globalCopy?: string;
  /** 可修复策略 */
  fixable: 'global-copy' | 'git-clone' | 'manual';
}

function skillHealthy(dir: string): boolean {
  try {
    return !!dir && statSync(dir).isDirectory() && existsSync(join(dir, 'SKILL.md'));
  } catch { return false; }
}

function readLock(home: string): Record<string, any> {
  const lockPath = join(home, '.agents', '.skill-lock.json');
  try { return JSON.parse(readFileSync(lockPath, 'utf8')).skills ?? {}; } catch { return {}; }
}

/** 列出所有死链/不完整的 skill,并标注每个能用什么策略修复 */
export function diagnoseDeadSkills(state: StationState, home: string = homedir()): DeadSkill[] {
  const lock = readLock(home);
  const globalDirs = [join(home, '.claude', 'skills'), join(home, '.agents', 'skills')];
  const result: DeadSkill[] = [];

  for (const [id, entry] of Object.entries(state.library.skills)) {
    if (skillHealthy(entry.sourcePath)) continue;

    // 1) 全局是否还有健康副本
    let globalCopy: string | undefined;
    for (const gd of globalDirs) {
      const cand = join(gd, id);
      if (skillHealthy(cand)) { globalCopy = cand; break; }
    }

    const info = lock[id] ?? {};
    const fixable: DeadSkill['fixable'] =
      globalCopy ? 'global-copy' : (info.sourceUrl ? 'git-clone' : 'manual');

    result.push({
      id,
      sourcePath: entry.sourcePath,
      sourceUrl: info.sourceUrl,
      skillPath: info.skillPath,
      globalCopy,
      fixable,
    });
  }
  return result;
}

export interface RepairReport {
  repaired: string[];
  failed: { id: string; reason: string }[];
  manual: string[];
}

/** 修复指定的死链 skill。global-copy 直接复制;git-clone 按 lock 来源拉取;manual 跳过。 */
export function repairDeadSkills(
  state: StationState,
  ids: string[],
  home: string = homedir(),
): { state: StationState; report: RepairReport } {
  const dead = diagnoseDeadSkills(state, home);
  const target = new Map(dead.filter(d => ids.includes(d.id)).map(d => [d.id, d]));
  const libDir = join(orbitPaths(home).orbitDir, 'library', 'skills');
  mkdirSync(libDir, { recursive: true });

  const report: RepairReport = { repaired: [], failed: [], manual: [] };
  let next = state;

  // global-copy: 逐个复制
  for (const d of target.values()) {
    if (d.fixable !== 'global-copy' || !d.globalCopy) continue;
    try {
      if (syncSkillIntoOrbitLibrary(next, d.id, d.globalCopy, home)) report.repaired.push(d.id);
      else report.failed.push({ id: d.id, reason: '复制后仍不健康' });
    } catch (e: any) {
      report.failed.push({ id: d.id, reason: e?.message ?? String(e) });
    }
  }

  // git-clone: 按仓库聚合,clone 一次修多个
  const byRepo = new Map<string, DeadSkill[]>();
  for (const d of target.values()) {
    if (d.fixable !== 'git-clone' || !d.sourceUrl) continue;
    const arr = byRepo.get(d.sourceUrl) ?? [];
    arr.push(d); byRepo.set(d.sourceUrl, arr);
  }
  for (const [url, items] of byRepo) {
    let cloned: { tmp: string; repo: string };
    try {
      cloned = cloneRepoShallow(url);
    } catch (e: any) {
      for (const d of items) report.failed.push({ id: d.id, reason: e?.message ?? String(e) });
      continue;
    }
    const { tmp, repo } = cloned;
    try {
      for (const d of items) {
        try {
          // doctor 是 overwrite-in-place,用低层 locateSkillDir 而非带冲突 guard 的 installSkillFromGit
          const srcDir = locateSkillDir(repo, d.skillPath, d.id);
          const dest = join(libDir, d.id);
          copyDirSafe(srcDir, dest);
          next.library.skills[d.id] = { id: d.id, name: d.id, sourcePath: dest };
          report.repaired.push(d.id);
        } catch (e: any) {
          report.failed.push({ id: d.id, reason: e?.message ?? String(e) });
        }
      }
    } finally {
      try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ok */ }
    }
  }

  for (const d of target.values()) {
    if (d.fixable === 'manual') report.manual.push(d.id);
  }

  if (report.repaired.length > 0) saveState(next, home);
  return { state: next, report };
}

export interface RemoveReport {
  removed: string[];
  failed: { id: string; reason: string }[];
}

/** 移除无源的死链/空壳 skill(diagnoseDeadSkills 判为 manual 且确实不健康的)。
 *  破坏性清理:删空 library 目录 + 全局死链 symlink + state 里所有引用。
 *  trash 用于删用户真实配置树里的条目(走废纸篓);未注入时回退 rmSync(供测试)。 */
export async function removeDeadSkills(
  state: StationState,
  ids: string[],
  home: string = homedir(),
  trash?: (p: string) => Promise<void>,
): Promise<{ state: StationState; report: RemoveReport }> {
  // 只允许移除当前确实不健康的 id——重跑诊断求交集,防止误删健康 skill
  const unhealthy = new Set(diagnoseDeadSkills(state, home).map(d => d.id));
  const libDir = join(orbitPaths(home).orbitDir, 'library', 'skills');
  const globalDirs = [join(home, '.claude', 'skills'), join(home, '.agents', 'skills')];
  const report: RemoveReport = { removed: [], failed: [] };
  const next = state;

  for (const id of ids) {
    if (!unhealthy.has(id)) { report.failed.push({ id, reason: '不在死链列表(可能已健康)' }); continue; }
    try {
      // library 副本:Orbit 自有、已验不健康(无 SKILL.md)、不可恢复——护栏:绝不删含 SKILL.md 的目录
      const libEntry = join(libDir, id);
      if (existsSync(join(libEntry, 'SKILL.md'))) { report.failed.push({ id, reason: '目标含 SKILL.md,拒绝删除' }); continue; }
      if (existsSync(libEntry)) rmSync(libEntry, { recursive: true, force: true });
      // 全局死链 symlink:用户真实配置树,走废纸篓(未注入 trash 时回退 rmSync,供测试)
      for (const gd of globalDirs) {
        const cand = join(gd, id);
        let exists = false;
        try { exists = !!lstatSync(cand); } catch { /* 不存在 */ }
        if (!exists) continue;
        if (trash) await trash(cand); else rmSync(cand, { recursive: true, force: true });
      }
      // 清 state 里所有引用:library 条目 + bundle 引用 + 全局 bundle 安装记录 +
      // 项目 assignment/lastApplied(否则下次 apply 可能重建死链 symlink)
      delete next.library.skills[id];
      for (const b of Object.values(next.library.bundles ?? {})) b.skills = b.skills.filter(s => s !== id);
      for (const e of Object.values(next.globalBundleApplied ?? {})) e.skills = e.skills.filter(s => s !== id);
      for (const a of Object.values(next.assignments ?? {})) a.skills = a.skills.filter(s => s !== id);
      for (const la of Object.values(next.lastApplied ?? {})) la.skills = la.skills.filter(s => s !== id);
      report.removed.push(id);
    } catch (e: any) {
      report.failed.push({ id, reason: e?.message ?? String(e) });
    }
  }

  if (report.removed.length > 0) saveState(next, home);
  return { state: next, report };
}
