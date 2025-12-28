import React, { useEffect, useState } from 'react';

export const App = () => {
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [openAtLogin, setOpenAtLogin] = useState<boolean>(true);
  const [openSettingsOnLaunch, setOpenSettingsOnLaunch] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Check if electronAPI is available
        if (!window.electronAPI) {
          throw new Error('electronAPI not found - preload script may not have loaded');
        }

        const settings = await window.electronAPI.getSettings();
        setIntervalMinutes(settings.intervalMinutes);
        setOpenAtLogin(settings.openAtLogin);
        setOpenSettingsOnLaunch(settings.openSettingsOnLaunch);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await window.electronAPI.saveSettings({
        intervalMinutes,
        openAtLogin,
        openSettingsOnLaunch,
      });
      // Settings saved notification is shown by the main process
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      await window.electronAPI.testNotification();
    } catch (error) {
      console.error('Failed to test notification:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gradient-to-br from-blue-50 to-cyan-50 p-8 h-full">
      <div>
        <div className="flex items-center justify-center mb-6">
          <span className="text-5xl mb-2">💧</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">Water Reminder</h1>
        <p className="text-gray-600 text-center mb-8 text-sm">Stay hydrated and healthy</p>
      </div>

      <div className="flex flex-col flex-1 justify-between">
        <div className="space-y-6">
          {/* Interval Setting */}
          <div>
            <div>
              <label htmlFor="interval" className="block text-sm font-medium text-gray-700 mb-2">
                Reminder Interval (minutes)
              </label>

              <select
                id="interval"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
              >
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="10">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="240">4 hours</option>
              </select>

              {/* <input
                id="interval"
                type="number"
                min="5" // 5 minutes
                max="240" // 4 hours
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              /> */}
            </div>

            <p className="mt-1 text-xs text-gray-500">
              You'll be reminded every {intervalMinutes} minute{intervalMinutes !== 1 ? 's' : ''} to
              drink water
            </p>
          </div>

          {/* Auto-launch Setting */}
          <div className="flex items-center">
            <input
              id="autolaunch"
              type="checkbox"
              checked={openAtLogin}
              onChange={(e) => setOpenAtLogin(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="autolaunch" className="ml-3 text-sm font-medium text-gray-700">
              Run on login
            </label>
          </div>

          {/* Open Settings on Launch Setting */}
          <div className="flex items-center">
            <input
              id="openOnLaunch"
              type="checkbox"
              checked={openSettingsOnLaunch}
              onChange={(e) => setOpenSettingsOnLaunch(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="openOnLaunch" className="ml-3 text-sm font-medium text-gray-700">
              Open settings on launch
            </label>
          </div>
        </div>

        <div>
          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={handleTest}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition duration-200 border border-gray-300"
            >
              Test Notification
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              This app runs in your system tray. Right-click the tray icon to access settings or
              quit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
