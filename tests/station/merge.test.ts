import { describe, it, expect } from 'vitest';
import { mergeMcpJson, mergeLocalScope } from '../../src/main/station/merge';

describe('mergeMcpJson', () => {
  it('replaces mcpServers, preserves other top-level keys', () => {
    const existing = { mcpServers: { old: { command: 'x' } }, someOtherKey: 42 };
    const next = mergeMcpJson(existing, { exa: { command: 'exa' } });
    expect(next.mcpServers).toEqual({ exa: { command: 'exa' } });
    expect((next as any).someOtherKey).toBe(42);
  });
  it('works from undefined existing', () => {
    expect(mergeMcpJson(undefined, { exa: { command: 'exa' } })).toEqual({ mcpServers: { exa: { command: 'exa' } } });
  });
});

describe('mergeLocalScope', () => {
  it('sets projects[path].mcpServers, preserves top-level mcpServers and lastCost', () => {
    const existing = {
      mcpServers: { globalA: { command: 'g' } },
      projects: { '/p': { lastCost: 9, mcpServers: { stale: { command: 's' } } }, '/other': { x: 1 } },
    };
    const next = mergeLocalScope(existing, '/p', { firecrawl: { command: 'npx' } });
    expect(next.projects['/p'].mcpServers).toEqual({ firecrawl: { command: 'npx' } });
    expect(next.projects['/p'].lastCost).toBe(9);
    expect(next.projects['/other']).toEqual({ x: 1 });
    expect(next.mcpServers).toEqual({ globalA: { command: 'g' } });
  });
  it('creates projects + project entry when missing', () => {
    const next = mergeLocalScope({}, '/p', { firecrawl: { command: 'npx' } });
    expect(next.projects['/p'].mcpServers).toEqual({ firecrawl: { command: 'npx' } });
  });
  it('does not mutate the input object', () => {
    const existing = { mcpServers: { globalA: { command: 'g' } }, projects: { '/p': { lastCost: 9 } } };
    const snapshot = JSON.stringify(existing);
    mergeLocalScope(existing, '/p', { firecrawl: { command: 'npx' } });
    expect(JSON.stringify(existing)).toBe(snapshot); // unchanged
  });
});
