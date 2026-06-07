import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseMcpJson } from '../../src/main/scanner/parseMcpJson';

describe('parseMcpJson', () => {
  it('returns [] when file missing', () => {
    expect(parseMcpJson('/no/such/.mcp.json')).toEqual([]);
  });

  it('parses servers as project-mcpjson scope', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-'));
    const file = join(dir, '.mcp.json');
    writeFileSync(file, JSON.stringify({
      mcpServers: {
        exa: { type: 'stdio', command: 'exa-mcp', args: ['--x'], env: { EXA_API_KEY: 'k' } },
      },
    }));
    const caps = parseMcpJson(file);
    expect(caps).toHaveLength(1);
    expect(caps[0].id).toBe('exa');
    expect(caps[0].scope).toBe('project-mcpjson');
    expect(caps[0].hasSecrets).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns [] on malformed JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-'));
    const file = join(dir, '.mcp.json');
    writeFileSync(file, '{ not json');
    expect(parseMcpJson(file)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});
