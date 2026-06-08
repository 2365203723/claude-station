import type { McpServerDef } from '../types';

export interface LibraryMcp { id: string; def: McpServerDef; hasSecrets: boolean; }
export interface LibrarySkill { id: string; name: string; sourcePath: string; }
export interface LibraryPlugin { id: string; marketplace?: string; name?: string; version?: string; }
export interface LibrarySnippet { id: string; name: string; kind: 'claudemd' | 'hooks' | 'env'; content: string; }

export interface StationLibrary {
  mcp: Record<string, LibraryMcp>;
  skills: Record<string, LibrarySkill>;
  plugins: Record<string, LibraryPlugin>;
  snippets: Record<string, LibrarySnippet>;
}

export interface ProjectAssignment {
  mcp: string[];
  skills: string[];
  plugins: string[];
  snippets: string[];
}

export interface AppliedSnapshot {
  mcpJson: Record<string, McpServerDef>;
  localScope: Record<string, McpServerDef>;
  skills: string[];
  plugins: string[];
  snippets: string[];
}

export interface StationState {
  version: number;
  library: StationLibrary;
  assignments: Record<string, ProjectAssignment>;
  lastApplied: Record<string, AppliedSnapshot>;
}

export interface FileChange {
  file: string;
  kind: 'mcpjson' | 'localscope' | 'skills' | 'settings' | 'claudemd';
  before: unknown;
  after: unknown;
  added: string[];
  removed: string[];
  changed: string[];
}
export interface ApplyPlan { changes: FileChange[]; }
