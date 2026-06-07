import { contextBridge, ipcRenderer } from 'electron';
import type { InferredState } from '../main/types';

contextBridge.exposeInMainWorld('station', {
  getState: (): Promise<InferredState> => ipcRenderer.invoke('station:getState'),
});
