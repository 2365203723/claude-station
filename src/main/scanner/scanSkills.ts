import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillCapability } from '../types';

// 一个目录只有同时满足「解析为目录」且「含 SKILL.md」才是有效 skill——
// Claude Code 也只把含 SKILL.md 的目录当 skill,空壳目录/死链 symlink 会被它忽略。
// Orbit 必须同样过滤,否则星球计数会把空壳算进去,与终端 `No skills found` 不一致。
function skillDirValid(fullPath: string): boolean {
  try {
    // statSync / existsSync 都会 follow symlink,目标里的 SKILL.md 检查免费搞定
    return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'SKILL.md'));
  } catch {
    return false; // broken symlink or unreadable entry
  }
}

export function scanSkills(dir: string, scope: 'user' | 'project'): SkillCapability[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => (e.isDirectory() || e.isSymbolicLink()) && skillDirValid(join(dir, e.name)))
    .map(e => ({ id: e.name, scope, path: join(dir, e.name) }));
}
