import { describe, it, expect } from 'vitest';
import { landedGlobalIds, globalCleanupStatus, removeGlobalMcp } from '../../src/main/station/cleanup';
import { emptyState } from '../../src/main/station/store';

describe('landedGlobalIds', () => {
  it('collects ids from both mcpJson and localScope of all projects lastApplied', () => {
    const s = emptyState();
    s.lastApplied['/a'] = { mcpJson: { exa: { command: 'exa' } }, localScope: { firecrawl: { command: 'npx' } }, skills: [], plugins: [], snippets: [] };
    s.lastApplied['/b'] = { mcpJson: {}, localScope: { memory: { command: 'm' } }, skills: [], plugins: [], snippets: [] };
    expect([...landedGlobalIds(s)].sort()).toEqual(['exa', 'firecrawl', 'memory']);
  });
  it('empty when nothing applied', () => {
    expect([...landedGlobalIds(emptyState())]).toEqual([]);
  });
});

describe('globalCleanupStatus', () => {
  it('splits top-level ids into eligible (landed) and blocked (not landed)', () => {
    const s = emptyState();
    s.lastApplied['/a'] = { mcpJson: {}, localScope: { firecrawl: { command: 'npx' } }, skills: [], plugins: [], snippets: [] };
    const status = globalCleanupStatus(['firecrawl', 'memory', 'codegraph'], s);
    expect(status.eligible).toEqual(['firecrawl']);
    expect(status.blocked.sort()).toEqual(['codegraph', 'memory']);
  });
});

describe('removeGlobalMcp', () => {
  it('removes only given ids from top-level mcpServers, preserves everything else', () => {
    const cj = {
      mcpServers: { firecrawl: { command: 'npx' }, memory: { command: 'm' }, codegraph: { command: 'c' } },
      projects: { '/a': { lastCost: 5, mcpServers: { local: { command: 'l' } } } },
      someKey: 1,
    };
    const next = removeGlobalMcp(cj, ['firecrawl']);
    expect(Object.keys(next.mcpServers).sort()).toEqual(['codegraph', 'memory']);
    expect(next.projects['/a'].mcpServers).toEqual({ local: { command: 'l' } });
    expect(next.projects['/a'].lastCost).toBe(5);
    expect(next.someKey).toBe(1);
  });
  it('does not mutate input', () => {
    const cj = { mcpServers: { firecrawl: { command: 'npx' } } };
    const snapshot = JSON.stringify(cj);
    removeGlobalMcp(cj, ['firecrawl']);
    expect(JSON.stringify(cj)).toBe(snapshot);
  });
  it('idempotent: removing absent id is a no-op', () => {
    const cj = { mcpServers: { memory: { command: 'm' } } };
    const next = removeGlobalMcp(cj, ['firecrawl']);
    expect(next.mcpServers).toEqual({ memory: { command: 'm' } });
  });
  it('handles missing mcpServers gracefully', () => {
    expect(removeGlobalMcp({}, ['x']).mcpServers).toEqual({});
  });
});
