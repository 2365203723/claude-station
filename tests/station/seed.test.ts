import { describe, it, expect } from 'vitest';
import { seedStateFromInferred } from '../../src/main/station/seed';
import type { InferredState } from '../../src/main/types';

const inferred: InferredState = {
  userScope: {
    mcp: [{ id: 'firecrawl', scope: 'user', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true }],
    skills: [], plugins: [],
  },
  projects: [
    { path: '/p1', mcp: [
        { id: 'firecrawl', scope: 'project-local', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true },
        { id: 'exa', scope: 'project-mcpjson', def: { command: 'exa' }, hasSecrets: false },
      ], skills: [], plugins: [] },
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
});
