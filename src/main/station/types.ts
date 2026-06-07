import type { McpServerDef } from '../types';

export interface LibraryMcp { id: string; def: McpServerDef; hasSecrets: boolean; }
export interface StationLibrary { mcp: Record<string, LibraryMcp>; }
export interface ProjectAssignment { mcp: string[]; }

export interface AppliedSnapshot {
  mcpJson: Record<string, McpServerDef>;
  localScope: Record<string, McpServerDef>;
}

export interface StationState {
  version: number;
  library: StationLibrary;
  assignments: Record<string, ProjectAssignment>;
  lastApplied: Record<string, AppliedSnapshot>;
}

export interface FileChange {
  file: string;
  kind: 'mcpjson' | 'localscope';
  before: Record<string, McpServerDef>;
  after: Record<string, McpServerDef>;
  added: string[]; removed: string[]; changed: string[];
}
export interface ApplyPlan { changes: FileChange[]; }
