import { ipcMain } from 'electron';
import { buildState } from './scanner/buildState';

export function registerIpc(): void {
  ipcMain.handle('station:getState', () => buildState());
}
