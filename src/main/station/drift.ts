import type { AppliedSnapshot } from './types';

export function detectDrift(snapshot: AppliedSnapshot | undefined, current: AppliedSnapshot): boolean {
  if (!snapshot) return false;
  return JSON.stringify(snapshot) !== JSON.stringify(current);
}
