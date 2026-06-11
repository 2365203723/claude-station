/// <reference types="vite/client" />
import type { InferredState } from '../main/types';
import type { StationState, ApplyPlan, LibraryBundle } from '../main/station/types';

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
      getMcpEnv: (mcpId: string) => Promise<{ id: string; env: Record<string,string>; envMasked: Record<string,string>; hasSecrets: boolean } | null>;
      updateMcpEnv: (mcpId: string, env: Record<string,string>) => Promise<StationState>;
      detectBundles: () => Promise<StationState>;
      createBundle: (bundle: LibraryBundle) => Promise<StationState>;
      updateBundle: (id: string, updates: Partial<LibraryBundle>) => Promise<StationState>;
      deleteBundle: (id: string) => Promise<StationState>;
      assignBundle: (projectPath: string, bundleId: string) => Promise<StationState>;
      unassignBundle: (projectPath: string, bundleId: string) => Promise<StationState>;
      unmountProject: (projectPath: string) => Promise<StationState>;
      addProject: (projectPath: string) => Promise<StationState>;
      deleteProjectFolder: (projectPath: string) => Promise<boolean>;
      createProjectFolder: (parentDir: string, name: string) => Promise<string>;
      browseFolder: () => Promise<string | null>;
      listGlobalMcp: () => Promise<{ id: string; def: any }[]>;
      addGlobalMcp: (id: string, def: any) => Promise<boolean>;
      removeGlobalMcp: (id: string) => Promise<boolean>;
      listGlobalSkills: () => Promise<{ id: string; isSymlink: boolean }[]>;
      addGlobalSkill: (id: string, sourcePath?: string) => Promise<boolean>;
      removeGlobalSkill: (id: string) => Promise<boolean>;
      listGlobalPlugins: () => Promise<{ id: string; enabled: boolean }[]>;
      addGlobalPlugin: (id: string) => Promise<boolean>;
      removeGlobalPlugin: (id: string) => Promise<boolean>;
      assignGlobalBundle: (bundleId: string) => Promise<boolean>;
      unassignGlobalBundle: (bundleId: string) => Promise<boolean>;
      getGlobalSnapshot: () => Promise<{ mcp: { id: string; def: any; hasSecrets: boolean }[]; skills: { id: string; isSymlink: boolean }[]; plugins: { id: string; enabled: boolean }[] }>;
    };
  }
}
export {};
