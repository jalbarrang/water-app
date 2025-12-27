import { contextBridge, ipcRenderer } from 'electron';

// Define the settings interface for type safety
interface Settings {
  intervalMinutes: number;
  lastSent: number;
  openAtLogin: boolean;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<Settings> => {
    return ipcRenderer.invoke('get-settings');
  },
  saveSettings: (settings: Partial<Settings>): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('save-settings', settings);
  },
  testNotification: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('test-notification');
  },
});
