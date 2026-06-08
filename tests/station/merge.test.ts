import { describe, it, expect } from 'vitest';
import { mergeMcpJson, mergeLocalScope, mergePluginSettings, mergeSnippetClaudeMd, mergeSnippetSettings } from '../../src/main/station/merge';

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

describe('mergePluginSettings', () => {
  it('adds enabledPlugins to existing settings, preserves other keys', () => {
    const next = mergePluginSettings({ someKey: 1 }, { 'p1': true, 'p2': true });
    expect(next.enabledPlugins).toEqual({ p1: true, p2: true });
    expect(next.someKey).toBe(1);
  });
  it('merges with existing enabledPlugins', () => {
    const next = mergePluginSettings({ enabledPlugins: { old: true } }, { new: true });
    expect(next.enabledPlugins).toEqual({ old: true, new: true });
  });
  it('removes plugins set to false', () => {
    const next = mergePluginSettings({ enabledPlugins: { old: true } }, { old: false });
    expect(next.enabledPlugins).toEqual({});
  });
});

describe('mergeSnippetClaudeMd', () => {
  it('injects snippet blocks with markers', () => {
    const md = mergeSnippetClaudeMd('# My Doc\n\nSome text', [{ id: 's1', content: 'injected line' }]);
    expect(md).toContain('<!-- CLAUDE_STATION:SNIPPET:s1:START -->');
    expect(md).toContain('injected line');
    expect(md).toContain('<!-- CLAUDE_STATION:SNIPPET:s1:END -->');
    expect(md).toContain('# My Doc');
  });
  it('returns null for empty existing + empty blocks', () => {
    expect(mergeSnippetClaudeMd(undefined, [])).toBeNull();
  });
  it('updates existing snippet blocks when id matches', () => {
    const first = mergeSnippetClaudeMd('# Doc', [{ id: 's1', content: 'v1' }]);
    const second = mergeSnippetClaudeMd(first!, [{ id: 's1', content: 'v2' }]);
    expect(second).toContain('v2');
    expect(second).not.toContain('v1');
    // only one set of markers
    const starts = (second!.match(/CLAUDE_STATION:SNIPPET:s1:START/g) || []).length;
    expect(starts).toBe(1);
  });
  it('cleans up trailing blank lines after removal', () => {
    const md = mergeSnippetClaudeMd('# Doc\n\n<!-- CLAUDE_STATION:SNIPPET:s1:START -->\nold\n<!-- CLAUDE_STATION:SNIPPET:s1:END -->\n\n', []);
    expect(md).toBe('# Doc');
  });
});
