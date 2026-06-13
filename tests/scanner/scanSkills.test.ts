import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanSkills } from '../../src/main/scanner/scanSkills';

describe('scanSkills', () => {
  it('returns [] when dir missing', () => {
    expect(scanSkills('/no/such/dir', 'user')).toEqual([]);
  });

  it('lists subdirectories with SKILL.md as skills with given scope', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-skills-'));
    mkdirSync(join(dir, 'graphify'));
    writeFileSync(join(dir, 'graphify', 'SKILL.md'), '# graphify');
    mkdirSync(join(dir, 'recall'));
    writeFileSync(join(dir, 'recall', 'SKILL.md'), '# recall');
    mkdirSync(join(dir, 'empty'));                              // 无 SKILL.md → 空壳,跳过
    writeFileSync(join(dir, 'README.md'), 'not a skill');       // 文件应被忽略
    const skills = scanSkills(dir, 'user');
    expect(skills.map(s => s.id).sort()).toEqual(['graphify', 'recall']);
    expect(skills[0].scope).toBe('user');
    expect(skills.find(s => s.id === 'graphify')!.path).toBe(join(dir, 'graphify'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('skips directories and symlinks without SKILL.md (空壳/死链)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-empty-'));
    mkdirSync(join(dir, 'shell'));                              // 空目录,无 SKILL.md
    const realEmpty = mkdtempSync(join(tmpdir(), 'cs-realempty-'));
    mkdirSync(join(realEmpty, 'tgt'));                          // 目标也无 SKILL.md
    symlinkSync(join(realEmpty, 'tgt'), join(dir, 'linkshell'));// symlink → 空目录
    expect(scanSkills(dir, 'user')).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
    rmSync(realEmpty, { recursive: true, force: true });
  });

  it('counts symlinks that resolve to dirs WITH SKILL.md, skips broken symlinks and file-symlinks', () => {
    const realDirs = mkdtempSync(join(tmpdir(), 'cs-real-'));
    mkdirSync(join(realDirs, 'targetskill'));
    writeFileSync(join(realDirs, 'targetskill', 'SKILL.md'), '# t');
    const fileTarget = join(realDirs, 'afile.txt');
    writeFileSync(fileTarget, 'x');

    const dir = mkdtempSync(join(tmpdir(), 'cs-symlinks-'));
    mkdirSync(join(dir, 'realdir'));                                   // real dir
    writeFileSync(join(dir, 'realdir', 'SKILL.md'), '# r');            // → counts
    symlinkSync(join(realDirs, 'targetskill'), join(dir, 'linkeddir')); // symlink→dir(含 SKILL.md) → counts
    symlinkSync(fileTarget, join(dir, 'linkedfile'));                  // symlink→file → skipped
    symlinkSync(join(realDirs, 'nope'), join(dir, 'broken'));          // broken symlink → skipped

    const skills = scanSkills(dir, 'user');
    expect(skills.map(s => s.id).sort()).toEqual(['linkeddir', 'realdir']);

    rmSync(dir, { recursive: true, force: true });
    rmSync(realDirs, { recursive: true, force: true });
  });
});
