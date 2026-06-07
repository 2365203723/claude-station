import { describe, it, expect } from 'vitest';
import { parsePlugins } from '../../src/main/scanner/parsePlugins';

describe('parsePlugins', () => {
  const installed = {
    version: 2,
    plugins: {
      'superpowers@claude-plugins-official': [{ version: '5.1.0' }],
      'warp@claude-code-warp': [{ version: '2.1.0' }],
    },
  };

  it('marks enabled per the enabledPlugins map', () => {
    const caps = parsePlugins(installed, { 'superpowers@claude-plugins-official': true });
    const sp = caps.find(c => c.id === 'superpowers@claude-plugins-official')!;
    const warp = caps.find(c => c.id === 'warp@claude-code-warp')!;
    expect(sp.enabled).toBe(true);
    expect(warp.enabled).toBe(false);
  });

  it('handles missing installed data', () => {
    expect(parsePlugins(undefined, {})).toEqual([]);
    expect(parsePlugins({ plugins: {} }, {})).toEqual([]);
  });
});
