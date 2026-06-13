import { existsSync, mkdirSync, statSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { orbitPaths } from './paths';
import { copyDirSafe } from './copyDir';
import type { StationState } from './types';

/** 确保一个发现到的 skill 被复制进 Orbit 库,并让 library 指向 Orbit 副本。
 *  即使同名 skill 已存在,如果源不在 Orbit 库,也会刷新 Orbit 副本。
 *  返回 true 表示 state/文件发生了变化。 */
export function syncSkillIntoOrbitLibrary(
  state: StationState,
  id: string,
  sourcePath: string,
  home: string = homedir(),
): boolean {
  if (!sourcePath || !existsSync(sourcePath)) return false;
  const st = statSync(sourcePath);
  if (!st.isDirectory() || !existsSync(join(sourcePath, 'SKILL.md'))) return false;

  const libDir = join(orbitPaths(home).orbitDir, 'library', 'skills');
  const dest = join(libDir, id);
  // 关键:sourcePath 可能是 ~/.claude/skills/<id> 这样指向 dest 的 symlink(别名)。
  // 若只按字符串比较 sourcePath===dest 会判为「外部源」,随后 copyDirSafe 先 rmSync(dest)
  // 删掉库真身、再从 follow 到 dest 的 symlink 复制 → 把自己清空。app 一打开 skill 就没了。
  // 因此解析真实路径(realpath)再比较:解析后相等即视为已在库,绝不复制。
  const sameAsDest = (() => {
    try { return realpathSync(sourcePath) === realpathSync(dest); } catch { return sourcePath === dest; }
  })();
  const alreadyInOrbit = sourcePath === dest || sameAsDest;
  const current = state.library.skills[id];

  mkdirSync(libDir, { recursive: true });

  if (!alreadyInOrbit) {
    // 覆盖同名旧副本,解决「global 新装同名 skill,Orbit 仍指旧副本」的问题
    copyDirSafe(sourcePath, dest);
  }

  if (current?.sourcePath === dest && current?.name === id) return !alreadyInOrbit;
  state.library.skills[id] = { id, name: id, sourcePath: dest };
  return true;
}
