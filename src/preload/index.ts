import { contextBridge, ipcRenderer } from 'electron';
import type { InferredState } from '../main/types';
import type { StationState, ApplyPlan } from '../main/station/types';

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
});
