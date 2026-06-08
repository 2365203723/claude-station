/// <reference types="vite/client" />
import type { InferredState } from '../main/types';
import type { StationState, ApplyPlan } from '../main/station/types';

declare global {
  interface Window {
    station: {
      getState: () => Promise<InferredState>;
      loadDesired: () => Promise<StationState>;
      assign: (projectPath: string, mcpId: string) => Promise<StationState>;
      unassign: (projectPath: string, mcpId: string) => Promise<StationState>;
      assignSkill: (projectPath: string, skillId: string) => Promise<StationState>;
      unassignSkill: (projectPath: string, skillId: string) => Promise<StationState>;
      assignPlugin: (projectPath: string, pluginId: string) => Promise<StationState>;
      unassignPlugin: (projectPath: string, pluginId: string) => Promise<StationState>;
      assignSnippet: (projectPath: string, snippetId: string) => Promise<StationState>;
      unassignSnippet: (projectPath: string, snippetId: string) => Promise<StationState>;
      plan: (projectPaths: string[]) => Promise<ApplyPlan>;
      apply: (projectPaths: string[]) => Promise<StationState>;
      globalStatus: () => Promise<{ eligible: string[]; blocked: string[] }>;
      cleanupGlobal: (ids: string[]) => Promise<string[]>;
    };
  }
}
export {};
