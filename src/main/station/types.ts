import type { McpServerDef } from '../types';

export interface LibraryMcp { id: string; def: McpServerDef; hasSecrets: boolean; }
export interface LibrarySkill { id: string; name: string; sourcePath: string; }
export interface LibraryPlugin { id: string; marketplace?: string; name?: string; version?: string; }
export interface LibrarySnippet { id: string; name: string; kind: 'claudemd' | 'hooks' | 'env'; content: string; }

export interface LibraryBundle {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  homepage?: string;
  version: string;
  mcp: string[];       // library.mcp 中的 MCP ID
  skills: string[];    // library.skills 中的 skill ID
  plugins: string[];   // library.plugins 中的 plugin ID
  autoDetected?: boolean;
}

export interface StationLibrary {
  mcp: Record<string, LibraryMcp>;
  skills: Record<string, LibrarySkill>;
  plugins: Record<string, LibraryPlugin>;
  snippets: Record<string, LibrarySnippet>;
  bundles: Record<string, LibraryBundle>;
}

export interface ProjectAssignment {
  mcp: string[];
  skills: string[];
  plugins: string[];
  snippets: string[];
  bundles: string[];
}

export interface AppliedSnapshot {
  mcpJson: Record<string, McpServerDef>;
  localScope: Record<string, McpServerDef>;
  skills: string[];
  plugins: string[];
  snippets: string[];
  bundles: string[];
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
