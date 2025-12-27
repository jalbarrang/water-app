import { Cron } from 'croner';
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, Tray } from 'electron';
import started from 'electron-squirrel-startup';
import Store, { type Schema } from 'electron-store';
import path from 'node:path';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Settings store interface
interface Settings {
  intervalMinutes: number;
  lastSent: number;
  openAtLogin: boolean;
}

// Define schema for electron-store
const schema: Schema<Settings> = {
  intervalMinutes: {
    type: 'number',
    default: 15,
  },
  lastSent: {
    type: 'number',
    default: 0,
  },
  openAtLogin: {
    type: 'boolean',
    default: false,
  },
};

// Type definition for store with proper methods
type StoreType = {
  get<K extends keyof Settings>(key: K, defaultValue?: Settings[K]): Settings[K];
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  set(object: Partial<Settings>): void;
  store: Settings;
  delete<K extends keyof Settings>(key: K): void;
};

// Initialize electron-store with defaults
const store = new Store<Settings>({ schema }) as unknown as StoreType;

// Global references to prevent garbage collection
let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;
let scheduler: Cron | null = null;

// Function to show water reminder notification
function showWaterNotification() {
  const notification = new Notification({
    title: '💧 Time to Drink Water!',
    body: 'Stay hydrated! Take a moment to drink some water.',
    silent: false,
  });

  notification.show();

  // Update last sent timestamp
  store.set('lastSent', Date.now());
}

// Function to check if notification should be sent
function checkAndNotify() {
  const { lastSent, intervalMinutes } = store.store;

  if (lastSent === 0) {
    return;
  }

  const now = Date.now();
  const timeSinceLastSent = now - lastSent;
  const intervalMs = intervalMinutes * 60 * 1000;

  if (timeSinceLastSent >= intervalMs) {
    showWaterNotification();
  }
}

// Create the settings window
const createSettingsWindow = () => {
  // If window already exists, focus it
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 700,
    title: 'Water Reminder Settings',
    icon: 'images/icon.png',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  settingsWindow.setMenuBarVisibility(false);

  // Load the settings window
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    settingsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Don't quit app when window is closed
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
};

// Initialize system tray
const createTray = () => {
  tray = new Tray('images/icon.png');
  tray.setToolTip('Water Reminder');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Settings',
      click: () => {
        createSettingsWindow();
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // click to open settings
  tray.on('click', () => {
    createSettingsWindow();
  });
};

// Initialize the scheduler
const initScheduler = () => {
  // Run every minute to check if we should send a notification
  scheduler = new Cron('* * * * *', () => {
    checkAndNotify();
  });

  store.set('lastSent', Date.now());
};

// Setup IPC handlers
const setupIpcHandlers = () => {
  // Get current settings
  ipcMain.handle('get-settings', () => {
    const settings = store.store;
    return settings;
  });

  // Save settings
  ipcMain.handle('save-settings', (_event, newSettings: Partial<Settings>) => {
    // Update store
    if (newSettings.intervalMinutes !== undefined) {
      store.set('intervalMinutes', newSettings.intervalMinutes);
    }

    if (newSettings.openAtLogin !== undefined) {
      store.set('openAtLogin', newSettings.openAtLogin);

      // Update Windows auto-launch setting
      app.setLoginItemSettings({
        openAtLogin: newSettings.openAtLogin,
      });
    }

    // Update lastSent to now
    store.set('lastSent', Date.now());

    // Show success notification
    const notification = new Notification({
      title: '✅ Settings Saved',
      body: 'Your water reminder settings have been updated.',
      silent: false,
    });
    notification.show();

    return { success: true };
  });

  // Test notification
  ipcMain.handle('test-notification', () => {
    showWaterNotification();
    return { success: true };
  });
};

// Configure auto-launch on first run
const configureAutoLaunch = () => {
  const openAtLogin = store.get('openAtLogin');
  app.setLoginItemSettings({
    openAtLogin,
  });
};

// App ready event
app.whenReady().then(() => {
  setupIpcHandlers();
  createTray();
  initScheduler();
  configureAutoLaunch();
});

// Prevent app from quitting when all windows are closed
// This keeps the tray icon active
app.on('window-all-closed', () => {
  // Don't quit the app - keep running in system tray
});

// On macOS, this is typically used to recreate windows
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createSettingsWindow();
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  // if scheduler is running, stop it
  if (scheduler) {
    scheduler.stop();
  }
});
