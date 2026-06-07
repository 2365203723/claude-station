import { join } from 'node:path';
import { homedir } from 'node:os';

export interface StationPaths { stationDir: string; stateFile: string; backupsDir: string; }

export function stationPaths(home: string = homedir()): StationPaths {
  const stationDir = join(home, '.claude-station');
  return { stationDir, stateFile: join(stationDir, 'state.json'), backupsDir: join(stationDir, 'backups') };
}
