import { describe, it, expect } from 'vitest';
import { assignMcp, unassignMcp, assignSkill, unassignSkill, assignPlugin, unassignPlugin, assignSnippet, unassignSnippet } from '../../src/main/station/assign';
import { emptyState } from '../../src/main/station/store';

function base() {
  const s = emptyState();
  s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
  s.library.skills['graphify'] = { id: 'graphify', name: 'graphify', sourcePath: '/tmp/skills/graphify' };
  s.library.plugins['superpowers@official'] = { id: 'superpowers@official' };
  s.library.snippets['my-hooks'] = { id: 'my-hooks', name: 'my-hooks', kind: 'hooks', content: '{}' };
  return s;
}

describe('assignMcp / unassignMcp', () => {
  it('assigns a library mcp to a project (immutably)', () => {
    const s = base();
    const next = assignMcp(s, '/p', 'exa');
    expect(next.assignments['/p'].mcp).toEqual(['exa']);
    expect(s.assignments['/p']).toBeUndefined(); // original untouched
  });
  it('is idempotent on duplicate assign', () => {
    let s = base();
    s = assignMcp(s, '/p', 'exa');
    s = assignMcp(s, '/p', 'exa');
    expect(s.assignments['/p'].mcp).toEqual(['exa']);
  });
  it('ignores assigning an id not in library', () => {
    const s = base();
    const next = assignMcp(s, '/p', 'ghost');
    expect(next).toEqual(s);
  });
  it('unassign removes the id', () => {
    let s = base();
    s = assignMcp(s, '/p', 'exa');
    s = unassignMcp(s, '/p', 'exa');
    expect(s.assignments['/p'].mcp).toEqual([]);
  });
});

describe('assignSkill / unassignSkill', () => {
  it('assigns a library skill to a project', () => {
    const s = base();
    const next = assignSkill(s, '/p', 'graphify');
    expect(next.assignments['/p'].skills).toEqual(['graphify']);
    expect(s.assignments['/p']).toBeUndefined();
  });
  it('is idempotent on duplicate assign', () => {
    let s = base();
    s = assignSkill(s, '/p', 'graphify');
    s = assignSkill(s, '/p', 'graphify');
    expect(s.assignments['/p'].skills).toEqual(['graphify']);
  });
  it('ignores assigning an id not in library', () => {
    const s = base();
    const next = assignSkill(s, '/p', 'ghost');
    expect(next).toEqual(s);
  });
  it('unassign removes the id', () => {
    let s = base();
    s = assignSkill(s, '/p', 'graphify');
    s = unassignSkill(s, '/p', 'graphify');
    expect(s.assignments['/p'].skills).toEqual([]);
  });
});

describe('assignPlugin / unassignPlugin', () => {
  it('assigns a library plugin to a project', () => {
    const s = base();
    const next = assignPlugin(s, '/p', 'superpowers@official');
    expect(next.assignments['/p'].plugins).toEqual(['superpowers@official']);
  });
  it('unassign removes the id', () => {
    let s = base();
    s = assignPlugin(s, '/p', 'superpowers@official');
    s = unassignPlugin(s, '/p', 'superpowers@official');
    expect(s.assignments['/p'].plugins).toEqual([]);
  });
});

describe('assignSnippet / unassignSnippet', () => {
  it('assigns a library snippet to a project', () => {
    const s = base();
    const next = assignSnippet(s, '/p', 'my-hooks');
    expect(next.assignments['/p'].snippets).toEqual(['my-hooks']);
  });
  it('unassign removes the id', () => {
    let s = base();
    s = assignSnippet(s, '/p', 'my-hooks');
    s = unassignSnippet(s, '/p', 'my-hooks');
    expect(s.assignments['/p'].snippets).toEqual([]);
  });
});
