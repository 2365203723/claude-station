import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { stationPaths } from './paths';

export function backupFiles(files: string[], stamp: string, home: string = homedir()): string {
  const dir = join(stationPaths(home).backupsDir, stamp);
  mkdirSync(dir, { recursive: true });
  for (const f of files) {
    if (!existsSync(f)) continue;
    const flat = f.replace(/[/\\]/g, '__').replace(/^__+/, '');
    copyFileSync(f, join(dir, flat));
  }
  return dir;
}
