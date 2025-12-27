// Type definitions for the Electron API exposed via contextBridge

interface Settings {
  intervalMinutes: number;
  lastSent: number;
  openAtLogin: boolean;
}

interface ElectronAPI {
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Partial<Settings>) => Promise<{ success: boolean }>;
  testNotification: () => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

