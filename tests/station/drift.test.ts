import { describe, it, expect } from 'vitest';
import { detectDrift } from '../../src/main/station/drift';
import type { AppliedSnapshot } from '../../src/main/station/types';

const snap: AppliedSnapshot = { mcpJson: { exa: { command: 'exa' } }, localScope: {}, skills: [], plugins: [], snippets: [] };

describe('detectDrift', () => {
  it('no snapshot → no drift', () => {
    expect(detectDrift(undefined, { mcpJson: { exa: { command: 'exa' } }, localScope: {}, skills: [], plugins: [], snippets: [] })).toBe(false);
  });
  it('identical → no drift', () => {
    expect(detectDrift(snap, { mcpJson: { exa: { command: 'exa' } }, localScope: {}, skills: [], plugins: [], snippets: [] })).toBe(false);
  });
  it('real file changed → drift', () => {
    expect(detectDrift(snap, { mcpJson: { exa: { command: 'CHANGED' } }, localScope: {}, skills: [], plugins: [], snippets: [] })).toBe(true);
  });
  it('real file gained a server → drift', () => {
    expect(detectDrift(snap, { mcpJson: { exa: { command: 'exa' }, new: { command: 'n' } }, localScope: {}, skills: [], plugins: [], snippets: [] })).toBe(true);
  });
});
