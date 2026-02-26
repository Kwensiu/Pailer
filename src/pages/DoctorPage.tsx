import { createSignal, onMount, createMemo, Show, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import Checkup, { CheckupItem } from '../components/page/doctor/Checkup';
import Cleanup from '../components/page/doctor/Cleanup';
import CacheManager from '../components/page/doctor/CacheManager';
import ShimManager from '../components/page/doctor/ShimManager';
import ScoopInfo from '../components/page/doctor/ScoopInfo';
import ScoopProxySettings from '../components/page/doctor/ScoopProxySettings';
import CommandInputField from '../components/page/doctor/CommandInputField';
import OperationModal from '../components/OperationModal';
import installedPackagesStore from '../stores/installedPackagesStore';
import { useOperations } from '../stores/operations';
import { t } from '../i18n';

const CACHE_DIR = 'cache';
const SHIMS_DIR = 'shims';

function DoctorPage() {
  const { addOperation, operations } = useOperations();

  const [installingHelper, setInstallingHelper] = createSignal<string | null>(null);

  // State lifted from Checkup.tsx
  const [checkupResult, setCheckupResult] = createSignal<CheckupItem[]>([]);
  const [isCheckupLoading, setIsCheckupLoading] = createSignal(true);
  const [checkupError, setCheckupError] = createSignal<string | null>(null);
  const [isRetrying, setIsRetrying] = createSignal(false);

  // Derived state from global operations store
  const currentOperationId = createMemo(() => {
    const ops = operations();
    // Find the first in-progress operation (prioritize cleanup operations)
    const cleanupOps = Object.keys(ops).filter(
      (id) =>
        ops[id].status === 'in-progress' &&
        (ops[id].title.includes('cleanup') || ops[id].title.includes('Cleaning'))
    );
    return cleanupOps.length > 0 ? cleanupOps[0] : null;
  });

  const currentOperation = createMemo(() => {
    const id = currentOperationId();
    return id ? operations()[id] : null;
  });

  const operationTitle = createMemo(() => {
    return currentOperation()?.title || null;
  });

  // Check if operation is already active using global store
  const isOperationActive = (operationId: string) => {
    return operations()[operationId]?.status === 'in-progress';
  };

  // Logic for running checkup, now in the parent component
  const runCheckup = async (isRetry = false) => {
    const operationId = 'checkup';
    if (isOperationActive(operationId)) {
      return;
    }

    if (isRetry) {
      setIsRetrying(true);
    } else {
      setIsCheckupLoading(true);
    }
    setCheckupError(null);
    try {
      const result = await invoke<CheckupItem[]>('run_scoop_checkup');
      setCheckupResult(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to run sfsu checkup:', errorMsg);
      setCheckupError(
        "Could not run sfsu checkup. Please ensure 'sfsu' is installed and accessible in your PATH."
      );
      setCheckupResult([]);
    } finally {
      if (isRetry) {
        setIsRetrying(false);
      } else {
        setIsCheckupLoading(false);
      }
    }
  };

  onMount(() => {
    runCheckup();
  });

  // Derived state to determine if checkup requires attention
  const needsAttention = createMemo(() => {
    if (isCheckupLoading() || checkupError() || checkupResult().length === 0) {
      return false;
    }
    // Needs attention if any item is not OK (status is false)
    return checkupResult().some((item) => !item.status);
  });

  const handleInstallHelper = async (helperId: string) => {
    setInstallingHelper(helperId);
    const operationId = `install-${helperId}`;
    if (isOperationActive(operationId)) {
      return;
    }
    try {
      await invoke('install_package', { packageName: helperId, bucket: '' });
      await runCheckup();
      installedPackagesStore.refetch();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to install ${helperId}:`, errorMsg);
    } finally {
      setInstallingHelper(null);
    }
  };

  const runOperation = (title: string, command: Promise<any>, operationId: string) => {
    if (isOperationActive(operationId)) {
      return;
    }

    // Add operation to the store
    addOperation({
      id: operationId,
      title,
      status: 'in-progress' as const,
      output: [],
      isMinimized: false,
    });

    command
      .then(() => {
        // Operation succeeded
        console.log(`Operation "${title}" completed successfully`);
      })
      .catch((err) => {
        // Operation failed
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Operation "${title}" failed:`, errorMsg);
      });
    // Modal closure is handled by its own event
  };

  const handleCleanupApps = () => {
    runOperation('Cleaning up old app versions...', invoke('cleanup_all_apps'), 'cleanup-apps');
  };

  const handleCleanupCache = () => {
    runOperation(
      'Cleaning up outdated cache...',
      invoke('cleanup_outdated_cache'),
      'cleanup-cache'
    );
  };

  const handleCloseOperationModal = (_operationId: string, wasSuccess: boolean) => {
    if (wasSuccess) {
      runCheckup();
    }
  };

  const getScoopSubPath = (subPath: string) => {
    return async () => {
      try {
        const scoopPath = await invoke<string>('get_scoop_path');
        return `${scoopPath}\\${subPath}`;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to get scoop path for ${subPath}:`, errorMsg);
        throw err;
      }
    };
  };

  const handleOpenCacheDirectory = async () => {
    try {
      const getPath = getScoopSubPath(CACHE_DIR);
      const cachePath = await getPath();
      console.log('Attempting to open cache directory:', cachePath);
      await openPath(cachePath);
    } catch (err) {
      console.error('Failed to open cache directory:', err);
    }
  };

  const handleOpenShimDirectory = async () => {
    try {
      const getPath = getScoopSubPath(SHIMS_DIR);
      const shimPath = await getPath();
      console.log('Attempting to open shim directory:', shimPath);
      await openPath(shimPath);
    } catch (err) {
      console.error('Failed to open shim directory:', err);
    }
  };

  const handleOpenScoopDirectory = async () => {
    try {
      const configDirectory = await invoke<string>('get_scoop_config_directory');
      console.log('Attempting to open Scoop config directory:', configDirectory);
      await openPath(configDirectory);
    } catch (err) {
      console.error('Failed to open Scoop config directory:', err);
    }
  };

  onCleanup(() => {
    // Cleanup is handled by the global store
  });

  const checkupComponent = (
    <Checkup
      checkupResult={checkupResult()}
      isLoading={isCheckupLoading()}
      isRetrying={isRetrying()}
      error={checkupError()}
      onRerun={() => runCheckup(true)}
      onInstallHelper={handleInstallHelper}
      installingHelper={installingHelper()}
    />
  );

  return (
    <>
      <div class="p-6">
        <h1 class="mb-6 text-3xl font-bold">{t('doctor.title')}</h1>

        <div class="space-y-8">
          <ScoopInfo onOpenDirectory={handleOpenScoopDirectory} />
          <CommandInputField />
          <ScoopProxySettings />

          <Show when={needsAttention()}>{checkupComponent}</Show>

          <Cleanup onCleanupApps={handleCleanupApps} onCleanupCache={handleCleanupCache} />
          <CacheManager
            onOpenDirectory={handleOpenCacheDirectory}
            onCleanupApps={handleCleanupApps}
            onCleanupCache={handleCleanupCache}
          />
          <ShimManager onOpenDirectory={handleOpenShimDirectory} />

          <Show
            when={
              !needsAttention() &&
              (isCheckupLoading() || checkupResult().length > 0 || checkupError())
            }
          >
            {checkupComponent}
          </Show>
        </div>
      </div>
      <OperationModal
        title={operationTitle()}
        operationId={currentOperationId() || undefined}
        onClose={handleCloseOperationModal}
      />
    </>
  );
}

export default DoctorPage;
