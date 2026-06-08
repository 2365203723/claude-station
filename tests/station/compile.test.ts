import { describe, it, expect } from 'vitest';
import { compileProjectTargets } from '../../src/main/station/compile';
import { emptyState } from '../../src/main/station/store';

function lib() {
  const s = emptyState();
  s.library.mcp['exa'] = { id: 'exa', def: { command: 'exa' }, hasSecrets: false };
  s.library.mcp['firecrawl'] = { id: 'firecrawl', def: { command: 'npx', env: { K: 'v' } }, hasSecrets: true };
  s.library.skills['graphify'] = { id: 'graphify', name: 'graphify', sourcePath: '/tmp/skills/graphify' };
  s.library.plugins['superpowers@official'] = { id: 'superpowers@official' };
  s.library.snippets['my-md'] = { id: 'my-md', name: 'my-md', kind: 'claudemd', content: '# Hello' };
  s.assignments['/p'] = { mcp: ['exa', 'firecrawl'], skills: ['graphify'], plugins: ['superpowers@official'], snippets: ['my-md'] };
  return s;
}

describe('compileProjectTargets', () => {
  it('routes non-secret to mcpJson, secret to localScope', () => {
    const t = compileProjectTargets(lib(), '/p');
    expect(Object.keys(t.mcpJson)).toEqual(['exa']);
    expect(t.mcpJson['exa']).toEqual({ command: 'exa' });
    expect(Object.keys(t.localScope)).toEqual(['firecrawl']);
    expect(t.localScope['firecrawl']).toEqual({ command: 'npx', env: { K: 'v' } });
  });
  it('compiles skills from library', () => {
    const t = compileProjectTargets(lib(), '/p');
    expect(t.skills).toEqual([{ id: 'graphify', sourcePath: '/tmp/skills/graphify' }]);
  });
  it('compiles plugins as enabledPlugins record', () => {
    const t = compileProjectTargets(lib(), '/p');
    expect(t.enabledPlugins).toEqual({ 'superpowers@official': true });
  });
  it('compiles snippets into snippetBlocks', () => {
    const t = compileProjectTargets(lib(), '/p');
    expect(t.snippetBlocks).toEqual([{ id: 'my-md', kind: 'claudemd', content: '# Hello' }]);
  });
  it('empty when no assignment', () => {
    const t = compileProjectTargets(emptyState(), '/none');
    expect(t).toEqual({ mcpJson: {}, localScope: {}, skills: [], enabledPlugins: {}, snippetBlocks: [] });
  });
});
