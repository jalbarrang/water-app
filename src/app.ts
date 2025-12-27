import { Cron } from 'croner';
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, Tray } from 'electron';
import started from 'electron-squirrel-startup';
import Store, { type Schema } from 'electron-store';
import path from 'node:path';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  log.info('App launched via Squirrel event, quitting...');
  app.quit();
}

import log from 'electron-log/main';

// Initialize logging immediately
log.initialize();
log.info('Water Reminder app starting...');

// Helper function to get the correct icon path for both dev and production
const getIconPath = (): string => {
  if (app.isPackaged) {
    // In production, the icon is in the resources folder (via extraResource)
    return path.join(process.resourcesPath, 'icon.png');
  }
  // In development, use the images folder relative to project root
  return path.join(app.getAppPath(), 'images', 'icon.png');
};

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
  log.info('Showing water reminder notification');
  const notification = new Notification({
    title: '💧 Time to Drink Water!',
    body: 'Stay hydrated! Take a moment to drink some water.',
    silent: false,
  });

  notification.show();

  // Update last sent timestamp
  store.set('lastSent', Date.now());
  log.info('Notification sent and timestamp updated');
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
    log.info('Settings window already exists, focusing');
    settingsWindow.focus();
    return;
  }

  log.info('Creating settings window');
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 700,
    title: 'Water Reminder Settings',
    icon: getIconPath(),
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
    const rendererPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    log.info('Loading settings window from', rendererPath);
    settingsWindow.loadFile(rendererPath);
  }

  // Don't quit app when window is closed
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
};

// Initialize system tray
const createTray = () => {
  log.info('Creating system tray');
  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('Water Reminder');
  log.info('System tray created successfully');

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
  log.info('Initializing notification scheduler');
  // Run every minute to check if we should send a notification
  scheduler = new Cron('* * * * *', () => {
    checkAndNotify();
  });

  store.set('lastSent', Date.now());
  log.info('Scheduler initialized and running');
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
    log.info('Saving settings', newSettings);
    // Update store
    if (newSettings.intervalMinutes !== undefined) {
      store.set('intervalMinutes', newSettings.intervalMinutes);
      log.info(`Interval updated to ${newSettings.intervalMinutes} minutes`);
    }

    if (newSettings.openAtLogin !== undefined) {
      store.set('openAtLogin', newSettings.openAtLogin);
      log.info(`Open at login set to ${newSettings.openAtLogin}`);

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

    log.info('Settings saved successfully');

    return { success: true };
  });

  // Test notification
  ipcMain.handle('test-notification', () => {
    log.info('Test notification requested');
    showWaterNotification();
    return { success: true };
  });
};

// Configure auto-launch on first run
const configureAutoLaunch = () => {
  const openAtLogin = store.get('openAtLogin');
  log.info(`Configuring auto-launch: ${openAtLogin}`);
  app.setLoginItemSettings({
    openAtLogin,
  });
};

// App ready event
app.whenReady().then(() => {
  log.info('App is ready, initializing components');
  setupIpcHandlers();
  createTray();
  initScheduler();
  configureAutoLaunch();
  log.info('All components initialized successfully');
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
  log.info('App is quitting, cleaning up');
  // if scheduler is running, stop it
  if (scheduler) {
    scheduler.stop();
    log.info('Scheduler stopped');
  }
});

if (process.platform === 'win32') {
  app.setAppUserModelId(app.name);
}
