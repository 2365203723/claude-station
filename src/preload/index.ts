import { contextBridge, ipcRenderer } from 'electron';
import type { InferredState } from '../main/types';
import type { StationState, ApplyPlan, LibraryBundle } from '../main/station/types';

contextBridge.exposeInMainWorld('station', {
  getState: (): Promise<InferredState> => ipcRenderer.invoke('station:getState'),
  loadDesired: (): Promise<StationState> => ipcRenderer.invoke('station:loadDesired'),
  assign: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:assign', p, id),
  unassign: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:unassign', p, id),
  assignSkill: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:assignSkill', p, id),
  unassignSkill: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:unassignSkill', p, id),
  assignPlugin: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:assignPlugin', p, id),
  unassignPlugin: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:unassignPlugin', p, id),
  assignSnippet: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:assignSnippet', p, id),
  unassignSnippet: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:unassignSnippet', p, id),
  plan: (paths: string[]): Promise<ApplyPlan> => ipcRenderer.invoke('station:plan', paths),
  apply: (paths: string[]): Promise<StationState> => ipcRenderer.invoke('station:apply', paths),
  globalStatus: (): Promise<{ eligible: string[]; blocked: string[] }> => ipcRenderer.invoke('station:globalStatus'),
  cleanupGlobal: (ids: string[]): Promise<string[]> => ipcRenderer.invoke('station:cleanupGlobal', ids),
  // Env editing
  getMcpEnv: (mcpId: string): Promise<{ id: string; env: Record<string,string>; envMasked: Record<string,string>; hasSecrets: boolean } | null> => ipcRenderer.invoke('station:getMcpEnv', mcpId),
  updateMcpEnv: (mcpId: string, env: Record<string,string>): Promise<StationState> => ipcRenderer.invoke('station:updateMcpEnv', mcpId, env),
  // Bundles
  detectBundles: (): Promise<StationState> => ipcRenderer.invoke('station:detectBundles'),
  createBundle: (bundle: LibraryBundle): Promise<StationState> => ipcRenderer.invoke('station:createBundle', bundle),
  updateBundle: (id: string, updates: Partial<LibraryBundle>): Promise<StationState> => ipcRenderer.invoke('station:updateBundle', id, updates),
  deleteBundle: (id: string): Promise<StationState> => ipcRenderer.invoke('station:deleteBundle', id),
  assignBundle: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:assignBundle', p, id),
  unassignBundle: (p: string, id: string): Promise<StationState> => ipcRenderer.invoke('station:unassignBundle', p, id),
  // Projects
  unmountProject: (projectPath: string): Promise<StationState> => ipcRenderer.invoke('station:unmountProject', projectPath),
  addProject: (projectPath: string): Promise<StationState> => ipcRenderer.invoke('station:addProject', projectPath),
  deleteProjectFolder: (projectPath: string): Promise<boolean> => ipcRenderer.invoke('station:deleteProjectFolder', projectPath),
  createProjectFolder: (parentDir: string, name: string): Promise<string> => ipcRenderer.invoke('station:createProjectFolder', parentDir, name),
  browseFolder: (): Promise<string | null> => ipcRenderer.invoke('station:browseFolder'),
  // Global settings
  listGlobalMcp: (): Promise<{ id: string; def: any }[]> => ipcRenderer.invoke('station:listGlobalMcp'),
  addGlobalMcp: (id: string, def: any): Promise<boolean> => ipcRenderer.invoke('station:addGlobalMcp', id, def),
  removeGlobalMcp: (id: string): Promise<boolean> => ipcRenderer.invoke('station:removeGlobalMcp', id),
  listGlobalSkills: (): Promise<{ id: string; isSymlink: boolean }[]> => ipcRenderer.invoke('station:listGlobalSkills'),
  addGlobalSkill: (id: string, sourcePath?: string): Promise<boolean> => ipcRenderer.invoke('station:addGlobalSkill', id, sourcePath),
  removeGlobalSkill: (id: string): Promise<boolean> => ipcRenderer.invoke('station:removeGlobalSkill', id),
  listGlobalPlugins: (): Promise<{ id: string; enabled: boolean }[]> => ipcRenderer.invoke('station:listGlobalPlugins'),
  addGlobalPlugin: (id: string): Promise<boolean> => ipcRenderer.invoke('station:addGlobalPlugin', id),
  removeGlobalPlugin: (id: string): Promise<boolean> => ipcRenderer.invoke('station:removeGlobalPlugin', id),
  assignGlobalBundle: (bundleId: string): Promise<boolean> => ipcRenderer.invoke('station:assignGlobalBundle', bundleId),
  unassignGlobalBundle: (bundleId: string): Promise<boolean> => ipcRenderer.invoke('station:unassignGlobalBundle', bundleId),
  getGlobalSnapshot: (): Promise<{ mcp: { id: string; def: any; hasSecrets: boolean }[]; skills: { id: string; isSymlink: boolean }[]; plugins: { id: string; enabled: boolean }[] }> => ipcRenderer.invoke('station:getGlobalSnapshot'),
});
