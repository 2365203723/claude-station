import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanSkills } from '../../src/main/scanner/scanSkills';

describe('scanSkills', () => {
  it('returns [] when dir missing', () => {
    expect(scanSkills('/no/such/dir', 'user')).toEqual([]);
  });

  it('lists subdirectories as skills with given scope', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-skills-'));
    mkdirSync(join(dir, 'graphify'));
    mkdirSync(join(dir, 'recall'));
    writeFileSync(join(dir, 'README.md'), 'not a skill'); // 文件应被忽略
    const skills = scanSkills(dir, 'user');
    expect(skills.map(s => s.id).sort()).toEqual(['graphify', 'recall']);
    expect(skills[0].scope).toBe('user');
    expect(skills.find(s => s.id === 'graphify')!.path).toBe(join(dir, 'graphify'));
    rmSync(dir, { recursive: true, force: true });
  });
});
