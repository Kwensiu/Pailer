import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage } from '../../types/scoop';
import { OperationStatus, OperationType } from '../../types/operations';
import installedPackagesStore from '../../stores/installedPackagesStore';
import { useOperations } from '../../stores/operations';
import { t } from '../../i18n';
import { toast } from '../../components/common/ToastAlert';
import settingsStore from '../../stores/settings';

interface UsePackageOperationsReturn {
  handleInstall: (pkg: ScoopPackage) => string | null;
  handleUninstall: (pkg: ScoopPackage) => string;
  handleUpdate: (pkg: ScoopPackage) => Promise<string | null>;
  handleForceUpdate: (pkg: ScoopPackage) => Promise<string | null>;
  handleUpdateAll: (packages: ScoopPackage[]) => Promise<string | null>;
  // Pailer self-update confirmation
  pailerUpdateConfirmOpen: () => boolean;
  setPailerUpdateConfirmOpen: (open: boolean) => void;
  pailerUpdateType: () => 'update' | 'force-update';
  handlePailerUpdateConfirm: () => Promise<void>;
  handlePailerUpdateCancel: () => void;
}

const {
  addOperation,
  addOperationOutput,
  addCompletionFollowUp,
  setOperationResult,
  updateOperation,
  getQueuedOperation,
  generateOperationId,
} = useOperations();

// Pailer self-update confirmation state
const [pailerUpdateConfirmOpen, setPailerUpdateConfirmOpen] = createSignal(false);
const [pailerUpdateType, setPailerUpdateType] = createSignal<'update' | 'force-update'>('update');
const [pendingPailerUpdate, setPendingPailerUpdate] = createSignal<(() => Promise<void>) | null>(
  null
);
const [isCheckingSelfUpdate, setIsCheckingSelfUpdate] = createSignal(false);

const checkAndSetupPailerSelfUpdate = async (
  pkg: ScoopPackage,
  updateType: 'update' | 'force-update'
): Promise<boolean> => {
  // Early return for non-pailer packages
  if (pkg.name !== 'pailer') {
    return false;
  }

  // Prevent concurrent checks but don't block normal flow
  if (isCheckingSelfUpdate()) {
    console.debug('Self-update check already in progress, allowing normal update');
    return false;
  }

  setIsCheckingSelfUpdate(true);

  try {
    // Check if self-update is available
    const canSelfUpdate = await invoke<boolean>('can_self_update');

    if (canSelfUpdate) {
      console.info(`Pailer self-update (${updateType}): showing confirmation dialog`);

      // Create update function with proper error handling
      const updateFunction = async () => {
        try {
          console.info(`Executing Pailer self-update (${updateType})...`);
          await invoke('update_pailer_self');
          console.info('Pailer self-update initiated successfully');
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error('Failed to execute Pailer self-update:', errorMessage);

          // Show user-friendly error message
          const userMessage = t('pailerUpdate.error', { error: errorMessage });
          showErrorNotification(userMessage);
        }
      };

      // Set up confirmation dialog
      setPendingPailerUpdate(() => updateFunction);
      setPailerUpdateType(updateType);
      setPailerUpdateConfirmOpen(true);

      return true; // Block normal update flow
    }

    console.info('Pailer is not installed via Scoop; allowing normal package update');
    return false;
  } catch (err) {
    // Handle unexpected errors during capability check
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Failed to check Pailer self-update capability:', errorMessage);

    // Only block update for critical errors, allow fallback for network/temporary issues
    const isCriticalError = errorMessage.includes('permission') || errorMessage.includes('access');
    if (isCriticalError) {
      const userMessage = t('pailerUpdate.error', { error: errorMessage });
      showErrorNotification(userMessage);
      return true; // Block normal update flow for critical errors
    }

    return false; // Allow normal update flow as fallback for temporary issues
  } finally {
    setIsCheckingSelfUpdate(false);
  }
};

// Helper functions for notifications using the existing toast system
const showErrorNotification = (message: string) => {
  console.error('Pailer Error:', message);
  toast.error(message);
};

const markOperationStartFailed = (operationId: string, operationName: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  addOperationOutput(operationId, {
    operationId,
    source: 'error',
    line: `[Pailer] Failed to start operation: ${message}`,
    message,
  });
  setOperationResult(operationId, {
    operationId,
    success: false,
    operationName,
    errorCount: 1,
    finalStatus: OperationStatus.Error,
    message,
    timestamp: Date.now(),
  });
};

const waitForOperation = (operationId: string): Promise<void> =>
  new Promise((resolve) => {
    addCompletionFollowUp(operationId, () => {
      resolve();
    });
  });

const queuedPackageOperationIds: string[] = [];
let packageOperationQueueRunning = false;

const runPackageOperationQueue = async () => {
  if (packageOperationQueueRunning) {
    return;
  }

  packageOperationQueueRunning = true;

  try {
    while (queuedPackageOperationIds.length > 0) {
      const operationId = queuedPackageOperationIds.shift()!;
      const task = pendingPackageOperationStarts.get(operationId);
      pendingPackageOperationStarts.delete(operationId);

      if (!task || !getQueuedOperation(operationId)) {
        continue;
      }

      const started = await task();
      if (started) {
        await waitForOperation(operationId);
      }
    }
  } finally {
    packageOperationQueueRunning = false;
    if (queuedPackageOperationIds.length > 0) {
      void runPackageOperationQueue();
    }
  }
};

const pendingPackageOperationStarts = new Map<string, () => Promise<boolean>>();

const schedulePackageOperation = (operationId: string, start: () => Promise<boolean>) => {
  if (settingsStore.settings.scoop.operationMode === 'concurrent') {
    void start();
    return;
  }

  pendingPackageOperationStarts.set(operationId, start);
  queuedPackageOperationIds.push(operationId);
  void runPackageOperationQueue();
};

const runUpdatePackageOperation = (
  operationId: string,
  pkg: ScoopPackage,
  title: string,
  force = false
) => {
  updateOperation(operationId, {
    title,
    status: OperationStatus.InProgress,
  });

  const skipPreUpdateRefresh = settingsStore.settings.scoop.skipPreUpdateRefresh;
  invoke('update_package', {
    packageName: pkg.name,
    force: force || undefined,
    operationId,
    skipPreUpdateRefresh,
  }).catch((err) => {
    console.error(force ? 'Force update invocation failed:' : 'Update invocation failed:', err);
    markOperationStartFailed(operationId, title, err);
  });
};

const performInstall = (pkg: ScoopPackage): string => {
  const operationId = generateOperationId(`install-${pkg.name}`);
  const title = t('packageInfo.installing', { name: pkg.name });

  addOperation({
    id: operationId,
    title,
    status: OperationStatus.Queued,
    isMinimized: true,
    output: [],
    isScan: false,
    operationType: OperationType.Install,
    packageName: pkg.name,
    bucketName: pkg.source,
  } as Parameters<typeof addOperation>[0]);

  schedulePackageOperation(operationId, async () => {
    if (!getQueuedOperation(operationId)) {
      return false;
    }

    updateOperation(operationId, {
      title,
      status: OperationStatus.InProgress,
    });

    invoke('install_package', {
      packageName: pkg.name,
      bucket: pkg.source,
      operationId,
      skipPreUpdateRefresh: settingsStore.settings.scoop.skipPreUpdateRefresh,
    }).catch((err) => {
      console.error(`Installation invocation failed for ${pkg.name}:`, err);
      markOperationStartFailed(operationId, title, err);
    });

    return true;
  });

  return operationId;
};

const handleInstall = (pkg: ScoopPackage) => {
  if (installedPackagesStore.packages().some((p) => p.name === pkg.name)) {
    toast.info(t('packageInfo.alreadyInstalled', { name: pkg.name }));
    return null;
  }

  return performInstall(pkg);
};

const handleUninstall = (pkg: ScoopPackage): string => {
  const operationId = generateOperationId(`uninstall-${pkg.name}`);
  const title = t('packageInfo.uninstalling', { name: pkg.name });

  addOperation({
    id: operationId,
    title,
    status: OperationStatus.Queued,
    isMinimized: true,
    output: [],
    isScan: false,
    operationType: OperationType.Uninstall,
    packageName: pkg.name,
    bucketName: pkg.source,
  } as Parameters<typeof addOperation>[0]);

  schedulePackageOperation(operationId, async () => {
    if (!getQueuedOperation(operationId)) {
      return false;
    }

    updateOperation(operationId, {
      title,
      status: OperationStatus.InProgress,
    });

    invoke('uninstall_package', {
      packageName: pkg.name,
      bucket: pkg.source,
      operationId,
    }).catch((err) => {
      console.error(`Uninstallation invocation failed for ${pkg.name}:`, err);
      markOperationStartFailed(operationId, title, err);
    });

    return true;
  });

  return operationId;
};

const handleUpdate = async (pkg: ScoopPackage): Promise<string | null> => {
  const operationId = generateOperationId(`update-${pkg.name}`);
  const title = t('packageInfo.updating', { name: pkg.name });

  addOperation({
    id: operationId,
    title: t('packageInfo.waitingUpdate', { name: pkg.name }),
    status: OperationStatus.Queued,
    isMinimized: true,
    output: [],
    isScan: false,
    operationType: OperationType.Update,
    packageName: pkg.name,
    bucketName: pkg.source,
  } as Parameters<typeof addOperation>[0]);

  schedulePackageOperation(operationId, async () => {
    if (!getQueuedOperation(operationId)) {
      return false;
    }

    const blockedBySelfUpdate = await checkAndSetupPailerSelfUpdate(pkg, 'update');
    if (!getQueuedOperation(operationId)) {
      return false;
    }

    if (blockedBySelfUpdate) {
      setOperationResult(operationId, {
        operationId,
        success: false,
        operationName: t('packageInfo.waitingUpdate', { name: pkg.name }),
        errorCount: 0,
        finalStatus: OperationStatus.Cancelled,
        message: t('operation.cancelled', { name: pkg.name }),
        timestamp: Date.now(),
      });
      return false;
    }

    runUpdatePackageOperation(operationId, pkg, title);
    return true;
  });

  return operationId;
};

const handleForceUpdate = async (pkg: ScoopPackage): Promise<string | null> => {
  const operationId = generateOperationId(`force-update-${pkg.name}`);
  const title = t('packageInfo.forceUpdating', { name: pkg.name });

  addOperation({
    id: operationId,
    title: t('packageInfo.waitingUpdate', { name: pkg.name }),
    status: OperationStatus.Queued,
    isMinimized: true,
    output: [],
    isScan: false,
    operationType: OperationType.Update,
    packageName: pkg.name,
    bucketName: pkg.source,
    forceUpdate: true,
  } as Parameters<typeof addOperation>[0]);

  schedulePackageOperation(operationId, async () => {
    if (!getQueuedOperation(operationId)) {
      return false;
    }

    const blockedBySelfUpdate = await checkAndSetupPailerSelfUpdate(pkg, 'force-update');
    if (!getQueuedOperation(operationId)) {
      return false;
    }

    if (blockedBySelfUpdate) {
      setOperationResult(operationId, {
        operationId,
        success: false,
        operationName: t('packageInfo.waitingUpdate', { name: pkg.name }),
        errorCount: 0,
        finalStatus: OperationStatus.Cancelled,
        message: t('operation.cancelled', { name: pkg.name }),
        timestamp: Date.now(),
      });
      return false;
    }

    runUpdatePackageOperation(operationId, pkg, title, true);
    return true;
  });

  return operationId;
};

const handleUpdateAll = async (packages: ScoopPackage[]): Promise<string | null> => {
  const updatablePackages = packages.filter((pkg) => !!pkg.available_version);
  if (updatablePackages.length === 0) {
    return null;
  }

  const batchId = generateOperationId('update-all-batch');

  const operationEntries: { pkg: ScoopPackage; operationId: string; title: string }[] = [];

  for (const pkg of updatablePackages) {
    const operationId = generateOperationId(`queued-update-${pkg.name}`);
    const title = t('packageInfo.updating', { name: pkg.name });
    operationEntries.push({ pkg, operationId, title });

    addOperation({
      id: operationId,
      title: t('packageInfo.waitingUpdate', { name: pkg.name }),
      status: OperationStatus.Queued,
      isMinimized: true,
      output: [],
      isScan: false,
      operationType: OperationType.Update,
      packageName: pkg.name,
      bucketName: pkg.source,
      updateBatchId: batchId,
    } as Parameters<typeof addOperation>[0]);
  }

  for (const { pkg, operationId, title } of operationEntries) {
    schedulePackageOperation(operationId, async () => {
      if (!getQueuedOperation(operationId)) {
        return false;
      }

      const blockedBySelfUpdate = await checkAndSetupPailerSelfUpdate(pkg, 'update');
      if (!getQueuedOperation(operationId)) {
        return false;
      }

      if (blockedBySelfUpdate) {
        setOperationResult(operationId, {
          operationId,
          success: false,
          operationName: t('packageInfo.waitingUpdate', { name: pkg.name }),
          errorCount: 0,
          warningCount: 0,
          finalStatus: OperationStatus.Cancelled,
          message: t('operation.cancelled', { name: pkg.name }),
          timestamp: Date.now(),
        });
        return false;
      }

      runUpdatePackageOperation(operationId, pkg, title);
      return true;
    });
  }

  return batchId;
};

const handlePailerUpdateConfirm = async () => {
  const updateFn = pendingPailerUpdate();
  if (updateFn) {
    setPailerUpdateConfirmOpen(false);
    setPendingPailerUpdate(null);
    await updateFn();
  }
};

const handlePailerUpdateCancel = () => {
  setPailerUpdateConfirmOpen(false);
  setPendingPailerUpdate(null);
};

export function usePackageOperations(): UsePackageOperationsReturn {
  return {
    handleInstall,
    handleUninstall,
    handleUpdate,
    handleForceUpdate,
    handleUpdateAll,
    // Pailer self-update confirmation
    pailerUpdateConfirmOpen,
    setPailerUpdateConfirmOpen,
    pailerUpdateType,
    handlePailerUpdateConfirm,
    handlePailerUpdateCancel,
  };
}
