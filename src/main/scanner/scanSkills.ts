import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillCapability } from '../types';

function resolvesToDir(fullPath: string): boolean {
  try {
    return statSync(fullPath).isDirectory(); // statSync follows symlinks
  } catch {
    return false; // broken symlink or unreadable entry
  }
}

export function scanSkills(dir: string, scope: 'user' | 'project'): SkillCapability[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory() || (e.isSymbolicLink() && resolvesToDir(join(dir, e.name))))
    .map(e => ({ id: e.name, scope, path: join(dir, e.name) }));
}
