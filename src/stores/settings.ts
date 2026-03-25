import { createRoot, createMemo, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { View } from '../types/scoop';
import { sysLang } from '../i18n';

/// Current store file name for frontend settings
const STORE_NAME = 'settings.json';

/// Global store instance for frontend settings (shared with signals)
let globalStore: Store | null = null;
let storeInitialized = false;

/// Get or initialize the shared store instance
export async function getSettingsStore(): Promise<Store> {
  if (!globalStore) {
    globalStore = await Store.load(STORE_NAME);
    console.log('Tauri store for frontend settings loaded successfully');
  }
  return globalStore;
}

interface Settings {
  virustotal: {
    enabled: boolean;
    autoScanOnInstall: boolean;
    apiKey?: string;
  };
  window: {
    closeToTray: boolean;
    firstTrayNotificationShown: boolean;
    silentStartup: boolean;
    trayAppsEnabled: boolean;
  };
  theme: 'dark' | 'light' | 'system';
  debug: {
    enabled: boolean;
  };
  cleanup: {
    autoCleanupEnabled: boolean;
    cleanupOldVersions: boolean;
    cleanupCache: boolean;
    preserveVersionCount: number;
  };
  buckets: {
    autoUpdateInterval: string; // "off" | "1h" | "6h" | "24h"
    autoUpdatePackagesEnabled: boolean;
    silentUpdateEnabled: boolean;
    updateHistoryEnabled: boolean;
  };
  update: {
    channel: 'stable';
    autoCheckEnabled: boolean;
  };
  defaultLaunchPage: View;
  scoopPath?: string;
  scoopPathManuallyConfigured?: boolean;
  language: string;
  trayAppsList: string[];
  powershell: {
    executable: 'auto' | 'pwsh' | 'powershell';
  };
}

const defaultSettings: Settings = {
  virustotal: {
    enabled: false,
    autoScanOnInstall: false,
  },
  window: {
    closeToTray: false,
    firstTrayNotificationShown: true,
    silentStartup: false,
    trayAppsEnabled: true,
  },
  theme: 'system',
  debug: {
    enabled: false,
  },
  cleanup: {
    autoCleanupEnabled: false,
    cleanupOldVersions: true,
    cleanupCache: true,
    preserveVersionCount: 3,
  },
  buckets: {
    autoUpdateInterval: 'off',
    autoUpdatePackagesEnabled: false,
    silentUpdateEnabled: false,
    updateHistoryEnabled: true,
  },
  update: {
    channel: 'stable',
    autoCheckEnabled: true,
  },
  defaultLaunchPage: 'installed',
  language: '',
  trayAppsList: [],
  powershell: {
    executable: 'auto',
  },
};

function createSettingsStore() {
  // Initialize the Tauri store
  const initStore = async () => {
    if (storeInitialized) return globalStore;

    globalStore = await getSettingsStore();
    storeInitialized = true;

    // First-time setup: migrate from localStorage if exists
    try {
      const localStorageData = localStorage.getItem('pailer-settings');
      if (localStorageData) {
        // Migrate data from localStorage to Tauri store
        const settingsData = JSON.parse(localStorageData);
        await globalStore!.set('settings', settingsData);
        await globalStore!.save();
        localStorage.removeItem('pailer-settings'); // Clean up localStorage after migration
      }
    } catch (error) {
      console.error('Error migrating settings from localStorage:', error);
    }

    return globalStore;
  };

  // Dynamic defaults for first launch detection
  const getFirstLaunchDefaults = (): Partial<Settings> => ({
    language: sysLang(),
  });

  const getInitialSettings = async (): Promise<Settings> => {
    const storeInstance = await initStore();

    // Check for factory reset marker
    const needsFactoryReset = await checkFactoryReset();

    if (needsFactoryReset) {
      // Clear any existing settings and return defaults
      if (storeInstance) {
        try {
          await storeInstance.delete('settings');
        } catch (error) {
          console.error('Error clearing settings during factory reset:', error);
        }
      }
      return { ...defaultSettings, ...getFirstLaunchDefaults() };
    }

    if (storeInstance) {
      try {
        const stored = await storeInstance.get<Settings>('settings');
        if (stored) {
          // Deep merge stored settings with defaults to handle new/missing keys
          let scoopPathValue = stored.scoopPath;
          // Migrate legacy scoop_path if scoopPath not set
          if (!scoopPathValue) {
            const legacyPath = await storeInstance.get<string>('scoop_path');
            if (legacyPath) {
              scoopPathValue = legacyPath;
              // Optionally save to new location
              (async () => {
                try {
                  const updatedSettings = { ...stored, scoopPath: legacyPath };
                  await storeInstance.set('settings', updatedSettings);
                  await storeInstance.delete('scoop_path');
                  await storeInstance.save();
                } catch (error) {
                  console.error('Error migrating scoop_path:', error);
                }
              })();
            }
          }
          return {
            ...defaultSettings,
            virustotal: {
              ...defaultSettings.virustotal,
              ...stored.virustotal,
            },
            window: {
              ...defaultSettings.window,
              ...stored.window,
              silentStartup: stored.window?.silentStartup ?? defaultSettings.window.silentStartup,
              trayAppsEnabled:
                stored.window?.trayAppsEnabled ?? defaultSettings.window.trayAppsEnabled,
            },
            theme: stored.theme || defaultSettings.theme,
            debug: {
              ...defaultSettings.debug,
              ...stored.debug,
            },
            cleanup: {
              ...defaultSettings.cleanup,
              ...stored.cleanup,
            },
            buckets: {
              ...defaultSettings.buckets,
              ...stored.buckets,
              silentUpdateEnabled:
                stored.buckets?.silentUpdateEnabled ?? defaultSettings.buckets.silentUpdateEnabled,
            },
            update: {
              ...defaultSettings.update,
              ...stored.update,
            },
            defaultLaunchPage: stored.defaultLaunchPage || defaultSettings.defaultLaunchPage,
            scoopPath: scoopPathValue,
            scoopPathManuallyConfigured: stored.scoopPathManuallyConfigured,
            language: stored.language || sysLang(),
            trayAppsList: stored.trayAppsList || defaultSettings.trayAppsList,
            powershell: {
              executable: stored.powershell?.executable || defaultSettings.powershell.executable,
            },
          };
        }
      } catch (error) {
        console.error('Error loading settings from store:', error);
      }
    }
    // First launch: no stored settings
    console.log('First launch detected, using dynamic defaults');
    return { ...defaultSettings, ...getFirstLaunchDefaults() };
  };

  const checkFactoryReset = async (): Promise<boolean> => {
    try {
      // Check if factory reset marker exists using a Tauri command
      const markerExists = await invoke<boolean>('check_factory_reset_marker');
      return markerExists;
    } catch (error) {
      console.error('Error checking factory reset marker:', error);
      return false;
    }
  };

  const [settings, setSettings] = createStore<Settings>({
    ...defaultSettings,
    language: '',
  });

  // Initialize settings from store on startup
  (async () => {
    const initialSettings = await getInitialSettings();
    setSettings(initialSettings);
    // Initialize backend PowerShell exe from settings
    try {
      await invoke('set_powershell_exe', { exe: initialSettings.powershell.executable });
    } catch (error) {
      console.error('Failed to initialize PowerShell exe in backend:', error);
    }
  })();

  const saveSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    const storeInstance = await getSettingsStore();
    if (storeInstance) {
      try {
        await storeInstance.set('settings', updated);
        await storeInstance.save();
      } catch (error) {
        console.error('Error saving settings to store:', error);
        throw error;
      }
    }
  };

  const setVirusTotalSettings = async (newVtSettings: Partial<Settings['virustotal']>) => {
    await saveSettings({
      virustotal: {
        ...settings.virustotal,
        ...newVtSettings,
      },
    });
  };

  const setWindowSettings = async (newWindowSettings: Partial<Settings['window']>) => {
    await saveSettings({
      window: {
        ...settings.window,
        ...newWindowSettings,
      },
    });
  };

  const setTheme = async (theme: 'dark' | 'light' | 'system') => {
    await saveSettings({ theme });
  };

  const setDebugSettings = async (newDebugSettings: Partial<Settings['debug']>) => {
    await saveSettings({
      debug: {
        ...settings.debug,
        ...newDebugSettings,
      },
    });
  };

  const setCleanupSettings = async (newCleanupSettings: Partial<Settings['cleanup']>) => {
    await saveSettings({
      cleanup: {
        ...settings.cleanup,
        ...newCleanupSettings,
      },
    });
  };

  const setBucketSettings = async (newBucketSettings: Partial<Settings['buckets']>) => {
    await saveSettings({
      buckets: {
        ...settings.buckets,
        ...newBucketSettings,
      },
    });
  };

  const setUpdateSettings = async (newUpdateSettings: Partial<Settings['update']>) => {
    await saveSettings({
      update: {
        ...settings.update,
        ...newUpdateSettings,
      },
    });
  };

  const setDefaultLaunchPage = async (page: View) => {
    await saveSettings({ defaultLaunchPage: page });
  };

  const setPowershellSettings = async (newPowershellSettings: Partial<Settings['powershell']>) => {
    try {
      await invoke('set_powershell_exe', { exe: newPowershellSettings.executable! });
      await saveSettings({
        powershell: {
          ...settings.powershell,
          ...newPowershellSettings,
        },
      });
    } catch (error) {
      console.error('Failed to update PowerShell exe in backend:', error);
    }
  };

  const setScoopPath = async (path: string) => {
    try {
      await invoke('set_scoop_path', { path });
      await saveSettings({ scoopPath: path, scoopPathManuallyConfigured: true });
    } catch (error) {
      console.error('Failed to set scoop path:', error);
    }
  };

  const setCoreSettings = async (newCoreSettings: Partial<Settings>) => {
    await saveSettings(newCoreSettings);
  };

  // Compute effective theme (resolve 'system' to actual dark/light)
  const getSystemTheme = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('prefers-color-scheme: dark')?.matches ?? false;
  };

  const [systemPrefersDark, setSystemPrefersDark] = createSignal(getSystemTheme());

  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia?.('prefers-color-scheme: dark');
    if (mediaQuery) {
      const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
      mediaQuery.addEventListener('change', handler);
    }
  }

  const effectiveTheme = createMemo<'dark' | 'light'>(() => {
    if (settings.theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
    return settings.theme;
  });

  return {
    settings,
    effectiveTheme,
    setVirusTotalSettings,
    setWindowSettings,
    setDebugSettings,
    setCleanupSettings,
    setBucketSettings,
    setUpdateSettings,
    setTheme,
    setDefaultLaunchPage,
    setPowershellSettings,
    setScoopPath,
    setCoreSettings,
  };
}

export default createRoot(createSettingsStore);
