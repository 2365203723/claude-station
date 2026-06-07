import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillCapability } from '../types';

export function scanSkills(dir: string, scope: 'user' | 'project'): SkillCapability[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => ({ id: e.name, scope, path: join(dir, e.name) }));
}
