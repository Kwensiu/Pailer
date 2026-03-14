import { createSignal, Show, onMount, createMemo, createEffect, onCleanup, For } from 'solid-js';
import './App.css';
import './i18n';
import './styles/minimized-indicator.css';
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
import ToastContainer from './components/common/ToastAlert.tsx';
import { listen } from '@tauri-apps/api/event';
import { info, error as logError } from '@tauri-apps/plugin-log';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import installedPackagesStore from './stores/installedPackagesStore';
import settingsStore from './stores/settings';
import { BucketInfo, updateBucketsCache } from './hooks/useBuckets';
import { useOperations } from './stores/operations';
import { t } from './i18n';
import { updateStore } from './stores/updateStore';
import { localStorageUtils } from './hooks/useSearchCache';
import { searchCacheManager } from './hooks/useSearchCache';

function App() {
  const { settings } = settingsStore;

  // Persist selected view across sessions.
  const [view, setView] = createSignal<View>(settings.defaultLaunchPage);

  const { operations, removeOperation } = useOperations();

  // Always start with false on app launch to ensure loading screen shows
  const [readyFlag, setReadyFlag] = createSignal<'true' | 'false'>('false');

  // Track if the app is installed via Scoop
  const [isScoopInstalled, setIsScoopInstalled] = createSignal<boolean>(false);

  const isReady = createMemo(() => readyFlag() === 'true');

  // Track if we have already performed update check to avoid duplicates
  const [updateCheckPerformed, setUpdateCheckPerformed] = createSignal(false);

  const [error, setError] = createSignal<string | null>(null);

  // Track initialization timeout
  const [initTimedOut, setInitTimedOut] = createSignal(false);

  // Auto-update modal state
  const [autoUpdateTitle, setAutoUpdateTitle] = createSignal<string | null>(null);

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

  // Perform update check when app becomes ready
  createEffect(() => {
    if (isReady() && !updateCheckPerformed()) {
      console.log('🔍 [App] App became ready, performing update check');
      setUpdateCheckPerformed(true);
      triggerUpdateCheck();
    }
  });

  createEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  });

  // Debug: track state changes (only in development)
  if (process.env.NODE_ENV === 'development') {
    createEffect(() => {
      console.log('App State Debug:', {
        readyFlag: readyFlag(),
        isReady: isReady(),
        error: error(),
        isScoopInstalled: isScoopInstalled(),
        initTimedOut: initTimedOut(),
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

  onMount(async () => {
    console.log('🔍 [App] onMount called - starting app initialization');

    // Setup event listeners FIRST so early backend emits are captured
    const setupColdStartListeners = async () => {
      console.log('🔍 [App] Setting up cold start listeners');
      const webview = getCurrentWebviewWindow();
      const unlistenFunctions: (() => void)[] = [];
      try {
        const unlisten = await listen<string>('auto-operation-start', (event) => {
          info(`Auto-operation started: ${event.payload}`);
          if (!settings.buckets.silentUpdateEnabled) {
            setAutoUpdateTitle(event.payload);
          }
        });
        unlistenFunctions.push(unlisten);
      } catch (e) {
        logError(`Failed to register auto-operation-start listener: ${e}`);
      }

      // Listen for window-specific cold-start-finished event
      try {
        const unlisten1 = await webview.listen<boolean>('cold-start-finished', (event) => {
          console.log(
            '🔍 [App] Received window-specific cold-start-finished event:',
            event.payload
          );
          info(`Received window-specific cold-start-finished event with payload: ${event.payload}`);
          handleColdStartEvent(event.payload);
        });
        unlistenFunctions.push(unlisten1);
      } catch (e) {
        logError(`Failed to register window-specific cold-start-finished listener: ${e}`);
      }

      // Listen for global cold-start-finished event as fallback
      try {
        const unlisten2 = await listen<boolean>('cold-start-finished', (event) => {
          console.log('🔍 [App] Received global cold-start-finished event:', event.payload);
          info(`Received global cold-start-finished event with payload: ${event.payload}`);
          handleColdStartEvent(event.payload);
        });
        unlistenFunctions.push(unlisten2);
      } catch (e) {
        logError(`Failed to register global cold-start-finished listener: ${e}`);
      }

      // Listen for window-specific scoop-ready event
      try {
        const unlisten3 = await webview.listen<boolean>('scoop-ready', (event) => {
          console.log('🔍 [App] Received window-specific scoop-ready event:', event.payload);
          info(`Received window-specific scoop-ready event with payload: ${event.payload}`);
          handleColdStartEvent(event.payload);
        });
        unlistenFunctions.push(unlisten3);
      } catch (e) {
        logError(`Failed to register window-specific scoop-ready listener: ${e}`);
      }

      // Listen for global scoop-ready event as fallback
      try {
        const unlisten4 = await listen<boolean>('scoop-ready', (event) => {
          console.log('🔍 [App] Received global scoop-ready event:', event.payload);
          info(`Received global scoop-ready event with payload: ${event.payload}`);
          handleColdStartEvent(event.payload);
        });
        unlistenFunctions.push(unlisten4);
      } catch (e) {
        logError(`Failed to register global scoop-ready listener: ${e}`);
      }

      // Listen for window close event to perform cleanup
      // Moved to onCleanup to avoid blocking app close
      /*
      try {
        const unlistenClose = await webview.onCloseRequested(async (_event) => {
          console.log('🧹 [App] Window close requested, performing cache cleanup...');
          info('Performing cache cleanup before app close');

          // Perform cache cleanup asynchronously (don't block close)
          setTimeout(() => {
            try {
              // Clean up expired cache entries
              localStorageUtils.cleanupOldCache(24 * 60 * 60 * 1000); // 24 hours
              // Ensure cache size is reasonable
              localStorageUtils.limitCacheSize(2 * 1024 * 1024); // 2MB limit before close
              console.log('🧹 Cache cleanup completed successfully');
            } catch (error) {
              console.warn('⚠️ Cache cleanup failed:', error);
            }
          }, 0);
        });
        unlistenFunctions.push(unlistenClose);
      } catch (e) {
        logError(`Failed to register window close listener: ${e}`);
      }
      */

      return () => {
        console.log('🧹 [App] Component unmounting, performing cache cleanup...');
        info('Performing cache cleanup on component unmount');

        try {
          // Clean up expired cache entries
          localStorageUtils.cleanupOldCache(24 * 60 * 60 * 1000); // 24 hours
          // Ensure cache size is reasonable
          localStorageUtils.limitCacheSize(2 * 1024 * 1024); // 2MB limit before close
          console.log('🧹 Cache cleanup completed successfully');
        } catch (error) {
          console.warn('⚠️ Cache cleanup failed:', error);
        }

        // Cleanup all listeners on unmount
        unlistenFunctions.forEach((unlisten) => unlisten());
      };
    };

    // Store cleanup function to be called when component unmounts
    let cleanupFunction: (() => void) | null = null;

    onCleanup(() => {
      if (cleanupFunction) {
        cleanupFunction();
      }
    });

    cleanupFunction = await setupColdStartListeners();

    // After listeners are in place, perform fast local checks (no network) sequentially
    try {
      const scoopInstalled = await invoke<boolean>('is_scoop_installation');
      setIsScoopInstalled(scoopInstalled);
      if (scoopInstalled) {
        info('App is installed via Scoop. Auto-update disabled.');
      }
    } catch (e) {
      console.error('Failed during initial local startup checks', e);
    }

    // Deferred / concurrent update check logic (network) with timeout; triggered after ready event
    // Note: triggerUpdateCheck is now defined at component level above

    // Handle cold start event payload
    const handleColdStartEvent = (payload: boolean) => {
      if (!isReady() && !error()) {
        info(`Handling cold start event with payload: ${payload}`);
        console.log(`Handling cold start event with payload: ${payload}`);
        console.log(`Current state before event: ready=${isReady()}, error=${error()}`);
        // Only update if not already ready
        if (payload) {
          info('Cold start ready event - triggering installed packages refetch');
          console.log('Setting ready flag to true');
          setReadyFlag('true');

          // Set initial view to default launch page
          setView(settings.defaultLaunchPage);

          // Trigger refetch of installed packages to ensure we get the freshly prefetched data
          // Use a small delay to ensure backend event is fully processed
          setTimeout(() => {
            info('Executing deferred refetch of installed packages');
            installedPackagesStore
              .refetch()
              .then(() => info('Refetch completed successfully'))
              .catch((err: unknown) => {
                logError(`Failed to refetch installed packages on cold start: ${err}`);
              });

            // Fetch and cache buckets list after initialization
            invoke<BucketInfo[]>('get_buckets')
              .then((buckets) => {
                if (buckets && buckets.length > 0) {
                  console.log(`Preloaded ${buckets.length} buckets`);
                  // Also update the buckets cache in the useBuckets hook
                  updateBucketsCache(buckets);
                }
              })
              .catch((err: unknown) => {
                logError(`Failed to fetch buckets: ${err}`);
                setError('Failed to load bucket list.');
              });
          }, 100);
          // Kick off update check shortly after readiness if applicable
          // Note: update check is now handled by createEffect after ready event
        } else {
          const errorMsg =
            'Scoop initialization failed. Please make sure Scoop is installed correctly and restart.';
          setError(errorMsg);
          setReadyFlag('false');
          logError(errorMsg);
        }
      } else if (isReady()) {
        info(`Received cold start event with payload: ${payload} (already ready)`);
      }
    };

    // Force ready state after a timeout as a fallback
    const timeoutId = setTimeout(() => {
      if (!isReady() && !error()) {
        const timeoutMsg =
          'Initialization is taking longer than expected. This might be due to a slow system or Scoop configuration issue.';
        info(`Forcing ready state after timeout. ${timeoutMsg}`);
        console.log(`Forcing ready state after timeout. ${timeoutMsg}`);
        setInitTimedOut(true);
        setReadyFlag('true');
        // Ensure update check still runs even if events were missed
        // Note: update check is now handled by createEffect when readyFlag changes
      }
    }, 3000); // Further reduce timeout to 3 seconds for immediate display

    // Also set up an immediate fallback for white screen issues
    const immediateFallback = setTimeout(() => {
      console.log('Immediate fallback: Setting ready flag to true after 1 second');
      setReadyFlag('true');
    }, 1000);

    // Clean up on unmount
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(immediateFallback);
      cleanupFunction();
    };
  });

  return (
    <>
      <Show when={!isReady() && !error()}>
        <div class="bg-base-100 flex h-screen flex-col items-center justify-center">
          <h1 class="mb-4 text-2xl font-bold">{t('app.title')}</h1>
          <p>{t('messages.loading')}</p>
          <span class="loading loading-spinner loading-lg mt-4"></span>
          <Show when={initTimedOut()}>
            <div class="text-warning mt-4 max-w-md text-center">
              <p>{t('messages.initTimeout')}</p>
              <p class="mt-2 text-sm">{t('messages.initTimeoutReason')}</p>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={error()}>
        <div class="bg-base-100 flex h-screen flex-col items-center justify-center">
          <h1 class="text-error mb-4 text-2xl font-bold">{t('status.error')}</h1>
          <p>{error()}</p>
          <Show when={initTimedOut()}>
            <div class="mt-4 max-w-md text-center">
              <p class="text-sm">{t('messages.initTimeoutShow')}</p>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={isReady()}>
        <div class="drawer" overflow-y-hidden>
          <input id="my-drawer" type="checkbox" class="drawer-toggle" />
          <div class="drawer-content flex h-screen flex-col">
            <Header currentView={view()} onNavigate={setView} />
            <main class="bg-base-200 z-1 flex-1 overflow-x-hidden overflow-y-auto p-6">
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
                <a onClick={() => setView('search')}>{t('app.search')}</a>
              </li>
              <li>
                <a onClick={() => setView('bucket')}>{t('app.buckets')}</a>
              </li>
              <li>
                <a onClick={() => setView('installed')}>{t('installed.header.title')}</a>
              </li>
              <li>
                <a onClick={() => setView('settings')}>{t('settings.title')}</a>
              </li>
              <li>
                <a onClick={() => setView('doctor')}>{t('doctor.title')}</a>
              </li>
            </ul>
          </div>
        </div>
        <DebugModal />
        <MinimizedIndicatorManager />
        <MultiInstanceWarning />
      </Show>
      {/* Render all active operation modals */}
      <For each={Object.values(operations())}>
        {(operation: OperationState) => (
          <Show when={!operation.isMinimized}>
            <OperationModal
              operationId={operation.id}
              title={operation.title}
              onOperationFinished={(_operationId, wasSuccess) => {
                if (wasSuccess && operation.title !== autoUpdateTitle()) {
                  if (
                    operation.operationType === 'install' ||
                    operation.operationType === 'uninstall' ||
                    operation.operationType === 'update'
                  ) {
                    installedPackagesStore.silentRefetch();
                    searchCacheManager.invalidateCache();
                  }
                }
              }}
              onClose={(_operationId, wasSuccess) => {
                // Only remove operation when user manually closes the modal
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
