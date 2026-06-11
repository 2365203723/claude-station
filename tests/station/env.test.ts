import { describe, it, expect } from 'vitest';
import { updateMcpEnv, maskEnvValue } from '../../src/main/station/env';
import type { StationState } from '../../src/main/station/types';

function emptyState(): StationState {
  return { version: 1, library: { mcp: {}, skills: {}, plugins: {}, snippets: {}, bundles: {} }, assignments: {}, lastApplied: {} };
}

describe('updateMcpEnv', () => {
  it('updates env on an existing MCP', () => {
    const state: StationState = {
      ...emptyState(),
      library: {
        ...emptyState().library,
        mcp: {
          firecrawl: { id: 'firecrawl', def: { command: 'npx', args: ['-y', 'firecrawl-mcp'] }, hasSecrets: false },
        },
      },
    };
    const next = updateMcpEnv(state, 'firecrawl', { FIRECRAWL_API_KEY: 'sk-abc123' });
    expect(next.library.mcp['firecrawl'].def.env).toEqual({ FIRECRAWL_API_KEY: 'sk-abc123' });
    expect(next.library.mcp['firecrawl'].hasSecrets).toBe(true);
  });

  it('clears secrets flag when env becomes empty', () => {
    const state: StationState = {
      ...emptyState(),
      library: {
        ...emptyState().library,
        mcp: {
          firecrawl: { id: 'firecrawl', def: { env: { KEY: 'val' } }, hasSecrets: true },
        },
      },
    };
    const next = updateMcpEnv(state, 'firecrawl', {});
    expect(next.library.mcp['firecrawl'].hasSecrets).toBe(false);
  });

  it('returns state unchanged for unknown MCP', () => {
    const state = emptyState();
    const next = updateMcpEnv(state, 'nonexistent', { KEY: 'val' });
    expect(next).toBe(state);
  });

  it('preserves other library fields', () => {
    const state: StationState = {
      ...emptyState(),
      library: {
        ...emptyState().library,
        mcp: { test: { id: 'test', def: {}, hasSecrets: false } },
        skills: { s1: { id: 's1', name: 's1', sourcePath: '/tmp' } },
        plugins: { p1: { id: 'p1' } },
      },
    };
    const next = updateMcpEnv(state, 'test', { API: 'key' });
    expect(next.library.skills['s1']).toBeDefined();
    expect(next.library.plugins['p1']).toBeDefined();
    expect(next.library.mcp['test'].hasSecrets).toBe(true);
    // 原 state 不变
    expect(state.library.mcp['test'].hasSecrets).toBe(false);
  });
});

describe('maskEnvValue', () => {
  it('masks long strings', () => {
    const masked = maskEnvValue('sk-abc123secret');
    expect(masked).toBe('sk-…');
  });

  it('masks short strings', () => {
    const masked = maskEnvValue('ab');
    expect(masked).toBe('•••');
  });
});
