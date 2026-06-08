import { describe, it, expect } from 'vitest';
import { seedStateFromInferred } from '../../src/main/station/seed';
import type { InferredState } from '../../src/main/types';

const inferred: InferredState = {
  userScope: {
    mcp: [{ id: 'firecrawl', scope: 'user', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true }],
    skills: [{ id: 'graphify', scope: 'user', path: '/home/.claude/skills/graphify' }],
    plugins: [{ id: 'superpowers@official', enabled: true }],
  },
  projects: [
    { path: '/p1', mcp: [
        { id: 'firecrawl', scope: 'project-local', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true },
        { id: 'exa', scope: 'project-mcpjson', def: { command: 'exa' }, hasSecrets: false },
      ], skills: [{ id: 'my-skill', scope: 'project', path: '/p1/.claude/skills/my-skill' }], plugins: [{ id: 'p1-plugin@org', enabled: true }] },
    { path: '/p2', mcp: [], skills: [], plugins: [] },
  ],
};

describe('seedStateFromInferred', () => {
  it('library contains user-scope + project MCP deduped by id', () => {
    const s = seedStateFromInferred(inferred);
    expect(Object.keys(s.library.mcp).sort()).toEqual(['exa', 'firecrawl']);
    expect(s.library.mcp['exa'].hasSecrets).toBe(false);
    expect(s.library.mcp['firecrawl'].hasSecrets).toBe(true);
  });
  it('assignments mirror each project current explicit MCP', () => {
    const s = seedStateFromInferred(inferred);
    expect(s.assignments['/p1'].mcp.sort()).toEqual(['exa', 'firecrawl']);
    expect(s.assignments['/p2'].mcp).toEqual([]);
  });
  it('lastApplied starts empty', () => {
    expect(seedStateFromInferred(inferred).lastApplied).toEqual({});
  });
  it('library contains user-scope skills and plugins', () => {
    const s = seedStateFromInferred(inferred);
    expect(s.library.skills['graphify']).toEqual({ id: 'graphify', name: 'graphify', sourcePath: '/home/.claude/skills/graphify' });
    expect(s.library.plugins['superpowers@official']).toEqual({ id: 'superpowers@official' });
  });
  it('assignments include skills, plugins, and empty snippets', () => {
    const s = seedStateFromInferred(inferred);
    expect(s.assignments['/p1'].skills).toEqual(['my-skill']);
    expect(s.assignments['/p1'].plugins).toEqual(['p1-plugin@org']);
    expect(s.assignments['/p1'].snippets).toEqual([]);
  });
});
