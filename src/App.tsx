import { createSignal, Show, onMount, createEffect, onCleanup, For, createMemo } from 'solid-js';
import './App.css';
import './i18n';
import Header from './components/page/Header.tsx';
import SearchPage from './pages/SearchPage.tsx';
import BucketPage from './pages/BucketPage.tsx';
import InstalledPage from './pages/InstalledPage.tsx';
import { View } from './types/scoop';
import type { OperationState } from './types/operations';
import SettingsPage from './pages/SettingsPage.tsx';
import DoctorPage from './pages/DoctorPage.tsx';
import DebugModal from './components/modals/DebugModal.tsx';
import MinimizedIndicatorManager from './components/modals/MinimizedOperationsTray.tsx';
import MultiInstanceWarning from './components/modals/MultiInstanceWarning.tsx';
import OperationModal from './components/modals/OperationModal.tsx';
import ScoopConfigWizard from './components/modals/ScoopConfigWizard.tsx';
import ToastContainer from './components/common/ToastAlert.tsx';
import { listen } from '@tauri-apps/api/event';
import { info, error as logError } from '@tauri-apps/plugin-log';
import { invoke } from '@tauri-apps/api/core';
import installedPackagesStore from './stores/installedPackagesStore';
import settingsStore from './stores/settings';
import { useBuckets } from './hooks/index';
import { useOperations } from './stores/operations';
import { t } from './i18n';
import { updateStore } from './stores/updateStore';
import { localStorageUtils } from './hooks/index';

function App() {
  const { settings } = settingsStore;
  let mainContentRef: HTMLElement | undefined;

  const [systemPrefersDark, setSystemPrefersDark] = createSignal(false);

  createEffect(() => {
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mql) return;

    const update = () => setSystemPrefersDark(mql.matches);
    update();

    mql.addEventListener('change', update);
    onCleanup(() => mql.removeEventListener('change', update));
  });

  const effectiveTheme = createMemo<'dark' | 'light'>(() => {
    if (settings.theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
    return settings.theme;
  });

  // Persist selected view across sessions.
  const [view, setView] = createSignal<View>(settings.defaultLaunchPage);

  const { operations, removeOperation } = useOperations();

  // Track if the app is installed via Scoop
  const [isScoopInstalled, setIsScoopInstalled] = createSignal<boolean>(false);

  // Track initialization status for timeout protection
  const [initError, setInitError] = createSignal<string | null>(null);
  const [isPreloading, setIsPreloading] = createSignal(false);

  // Track if we have already performed update check to avoid duplicates
  const [updateCheckPerformed, setUpdateCheckPerformed] = createSignal(false);

  // Track Scoop configuration status
  const [scoopConfigured, setScoopConfigured] = createSignal<boolean | null>(null);

  // Auto-update modal state
  const [autoUpdateTitle, setAutoUpdateTitle] = createSignal<string | null>(null);

  // Check if Scoop is properly configured
  const checkScoopConfiguration = async () => {
    try {
      const scoopPath = await invoke<string | null>('get_scoop_path');

      // Handle null case explicitly
      if (!scoopPath) {
        console.log('⚠️ [App] Scoop path not configured');
        setScoopConfigured(false);
        return false;
      }

      const pathExists = await invoke<boolean>('path_exists', { path: scoopPath });
      console.log(`🔍 [App] Scoop path: ${scoopPath}, exists: ${pathExists}`);
      setScoopConfigured(pathExists);
      return pathExists;
    } catch (err) {
      console.log('⚠️ [App] Failed to check Scoop configuration');
      setScoopConfigured(false);
      return false;
    }
  };

  // Unified data preload function - only runs if Scoop is configured
  const preloadData = async () => {
    info('Starting data preload for all pages');
    console.log('🔄 [App] Starting data preload');

    // Parallel preload all page data
    await Promise.allSettled([
      // Preload installed packages
      (async () => {
        console.log('🔄 [App] Preloading installed packages...');
        try {
          await installedPackagesStore.refetch();
          console.log('✅ [App] Installed packages preloaded');
          info('Installed packages preload completed');
        } catch (err: unknown) {
          console.log('⚠️ [App] Failed to preload installed packages');
          logError(`Failed to preload installed packages: ${err}`);
        }
      })(),

      // Preload buckets
      (async () => {
        console.log('🔄 [App] Preloading buckets...');
        const { fetchBuckets, cleanup } = useBuckets();
        try {
          // Use the internal fetchBuckets from a temporary useBuckets instance
          // This keeps the logic encapsulated within the hook
          await fetchBuckets(true, true); // forceRefresh=true, quiet=true
          console.log('✅ [App] Buckets preloaded via hook');
          info('Buckets preload completed');
        } catch (err: unknown) {
          console.log('⚠️ [App] Failed to preload buckets');
          logError(`Failed to preload buckets: ${err}`);
        } finally {
          cleanup();
        }
      })(),

      // Preload doctor page data: checkup and versioned apps
      (async () => {
        console.log('🔄 [App] Preloading doctor page data...');
        try {
          await Promise.all([invoke('run_scoop_checkup'), invoke('get_versioned_apps')]);
          console.log('✅ [App] Doctor page data preloaded');
          info('Doctor page data preload completed');
        } catch (err: unknown) {
          console.log('⚠️ [App] Failed to preload doctor data');
          logError(`Failed to preload doctor data: ${err}`);
        }
      })(),
    ]);
  };

  // Deferred / concurrent update check logic (network) with timeout; triggered after ready event
  const triggerUpdateCheck = async () => {
    console.log('🔍 [App] triggerUpdateCheck called', {
      isScoopInstalled: isScoopInstalled(),
      autoCheckEnabled: settings.update.autoCheckEnabled,
    });

    if (isScoopInstalled()) {
      console.log('🔍 [App] Skipping update check - installed via Scoop');
      return;
    }

    // Check if auto-check is enabled in settings
    if (!settings.update.autoCheckEnabled) {
      console.log('🔍 [App] Skipping update check - auto-check disabled by user settings');
      return;
    }

    console.log('🔍 [App] Starting automatic update check...');
    try {
      info('Checking for application updates...');
      await updateStore.checkForUpdates(false); // false = automatic check
      console.log('🔍 [App] Automatic update check completed');
    } catch (e) {
      console.error('Failed to check for updates', e);
    }
  };

  // Perform update check on mount (UI is always ready)
  createEffect(() => {
    if (!updateCheckPerformed()) {
      console.log('🔍 [App] App mounted, performing update check');
      setUpdateCheckPerformed(true);
      triggerUpdateCheck();
    }
  });

  createEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme());
  });

  if (import.meta.env.DEV) {
    createEffect(() => {
      console.log('App State:', {
        scoopConfigured: scoopConfigured(),
        isScoopInstalled: isScoopInstalled(),
      });
    });
  }

  const handleCloseAutoUpdateModal = (wasSuccess: boolean) => {
    if (wasSuccess && autoUpdateTitle()) {
      console.log('Auto-update completed successfully');
    }

    setAutoUpdateTitle(null);
    if (wasSuccess) {
      installedPackagesStore.refetch();
    }
  };

  const focusMainContent = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mainContentRef?.focus();
      });
    });
  };

  const handleNavigate = (nextView: View) => {
    setView(nextView);
    focusMainContent();
  };

  onMount(async () => {
    console.log('🚀 [App] App mounted - UI loaded, starting async initialization');
    info('Application UI loaded, starting background initialization');

    // Setup 5s timeout protection for initialization
    const initTimeout = setTimeout(() => {
      if (scoopConfigured() === null) {
        console.warn('⏱️ [App] Initialization timeout - Scoop configuration check took too long');
        setInitError('Initialization timed out. Please restart the application.');
        setScoopConfigured(false);
      }
    }, 5000);

    // Cleanup timeout on component unmount
    onCleanup(() => clearTimeout(initTimeout));

    // Setup auto-operation listener
    try {
      const unlisten = await listen<string>('auto-operation-start', (event) => {
        info(`Auto-operation started: ${event.payload}`);
        if (!settings.buckets.silentUpdateEnabled) {
          setAutoUpdateTitle(event.payload);
        }
      });
      onCleanup(unlisten);
    } catch (e) {
      logError(`Failed to register auto-operation-start listener: ${e}`);
    }

    // Check if installed via Scoop
    try {
      const scoopInstalled = await invoke<boolean>('is_scoop_installation');
      setIsScoopInstalled(scoopInstalled);
      if (scoopInstalled) {
        info('App is installed via Scoop. Auto-update disabled.');
      }
    } catch (e) {
      console.log('⚠️ [App] Failed to check Scoop installation status');
    }

    // Check Scoop configuration asynchronously
    const configured = await checkScoopConfiguration();

    if (configured) {
      console.log('✅ [App] Scoop is configured, preloading data...');
      setIsPreloading(true);
      // Preload data in background
      preloadData().then(() => {
        console.log('✅ [App] All data preloaded successfully');
        setIsPreloading(false);
      });
    } else {
      console.warn('⚠️ [App] Scoop not configured - user needs to configure path in settings');
      info('Scoop not configured. User will need to configure Scoop path in settings.');
    }

    // Cleanup on unmount
    onCleanup(() => {
      console.log('🧹 [App] Component unmounting, performing cache cleanup...');
      try {
        // Clean up old localStorage cache
        localStorageUtils.cleanupOldCache(24 * 60 * 60 * 1000);
        localStorageUtils.limitCacheSize(2 * 1024 * 1024);
        console.log('🧹 Cache cleanup completed');
      } catch (error) {
        console.warn('⚠️ [App] Cache cleanup failed:', error);
      }
    });
  });

  return (
    <>
      {/* Initialization error display */}
      <Show when={initError()}>
        <div class="alert alert-error rounded-none">
          <span>{initError()}</span>
        </div>
      </Show>

      {/* Data preloading indicator */}
      <Show when={isPreloading()}>
        <div class="bg-base-200 fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded px-3 py-2 shadow">
          <span class="loading loading-spinner loading-xs"></span>
          <span class="text-sm">{t('messages.loading')}</span>
        </div>
      </Show>

      {/* UI loads immediately, Scoop configuration checked in background */}
      <div class="drawer" overflow-y-hidden>
        <input id="my-drawer" type="checkbox" class="drawer-toggle" />
        <div class="drawer-content flex h-screen flex-col">
          <Header currentView={view()} onNavigate={handleNavigate} />
          <main
            ref={mainContentRef}
            class="bg-base-200 z-1 flex-1 overflow-x-hidden overflow-y-auto p-6 focus:outline-none"
            tabindex="-1"
          >
            <Show when={view() === 'search'}>
              <SearchPage />
            </Show>
            <Show when={view() === 'bucket'}>
              <BucketPage />
            </Show>
            <Show when={view() === 'installed'}>
              <InstalledPage onNavigate={setView} />
            </Show>
            <Show when={view() === 'settings'}>
              <SettingsPage
                activeSection=""
                onSectionChange={() => {}}
                isScoopInstalled={isScoopInstalled()}
              />
            </Show>
            <Show when={view() === 'doctor'}>
              <DoctorPage />
            </Show>
          </main>
        </div>
        <div class="drawer-side">
          <label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
          <ul class="menu bg-base-200 text-base-content min-h-full w-80 p-4">
            <li>
              <a onClick={() => handleNavigate('search')}>{t('app.search')}</a>
            </li>
            <li>
              <a onClick={() => handleNavigate('bucket')}>{t('app.buckets')}</a>
            </li>
            <li>
              <a onClick={() => handleNavigate('installed')}>{t('installed.header.title')}</a>
            </li>
            <li>
              <a onClick={() => handleNavigate('settings')}>{t('settings.title')}</a>
            </li>
            <li>
              <a onClick={() => handleNavigate('doctor')}>{t('doctor.title')}</a>
            </li>
          </ul>
        </div>
      </div>
      <DebugModal />
      <MinimizedIndicatorManager />
      <MultiInstanceWarning />

      {/* Show Scoop configuration wizard if Scoop is not configured */}
      <ScoopConfigWizard
        isOpen={scoopConfigured() === false}
        onConfigured={async () => {
          // Re-check configuration and reload data
          const configured = await checkScoopConfiguration();
          if (configured) {
            setIsPreloading(true);
            preloadData().then(() => {
              setIsPreloading(false);
            });
          }
        }}
      />

      {/* Render all active operation modals */}
      <For each={Object.values(operations())}>
        {(operation: OperationState) => (
          <Show when={!operation.isMinimized}>
            <OperationModal
              operationId={operation.id}
              title={operation.title}
              onOperationFinished={() => {
                // Cache refresh is handled by global listener in operations.ts
                // No need to duplicate the logic here
              }}
              onClose={(_operationId, wasSuccess) => {
                // Cache refresh is handled by global listener in operations.ts
                // Only handle modal cleanup here
                removeOperation(operation.id);
                if (operation.title === autoUpdateTitle()) {
                  handleCloseAutoUpdateModal(wasSuccess);
                }
              }}
              nextStep={operation.nextStep ?? undefined}
            />
          </Show>
        )}
      </For>
      <ToastContainer />
    </>
  );
}

export default App;
