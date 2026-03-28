import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage } from '../../types/scoop';
import { OperationNextStep, OperationStatus, OperationType } from '../../types/operations';
import installedPackagesStore from '../../stores/installedPackagesStore';
import { useOperations } from '../../stores/operations';
import { searchCacheManager } from '../search/useSearchCache';
import { t } from '../../i18n';
import { toast } from '../../components/common/ToastAlert';
import settingsStore from '../../stores/settings';

interface UsePackageOperationsReturn {
  operationTitle: () => string | null;
  setOperationTitle: (title: string | null) => void;
  operationNextStep: () => OperationNextStep | null;
  isScanning: () => boolean;
  pendingInstallPackage: () => ScoopPackage | null;
  handleInstall: (pkg: ScoopPackage) => void;
  handleInstallConfirm: () => void;
  handleUninstall: (pkg: ScoopPackage) => void;
  handleUpdate: (pkg: ScoopPackage) => Promise<void>;
  handleForceUpdate: (pkg: ScoopPackage) => Promise<void>;
  handleUpdateAll: () => void;
  closeOperationModal: (wasSuccess: boolean) => void;
  addCloseListener: (handler: (wasSuccess: boolean) => void) => () => void;
  // Pailer self-update confirmation
  pailerUpdateConfirmOpen: () => boolean;
  setPailerUpdateConfirmOpen: (open: boolean) => void;
  pailerUpdateType: () => 'update' | 'force-update';
  handlePailerUpdateConfirm: () => Promise<void>;
  handlePailerUpdateCancel: () => void;
}

const { addOperation } = useOperations();

const [operationTitle, setOperationTitle] = createSignal<string | null>(null);
const [operationNextStep, setOperationNextStep] = createSignal<OperationNextStep | null>(null);
const [isScanning, setIsScanning] = createSignal(false);
const [pendingInstallPackage, setPendingInstallPackage] = createSignal<ScoopPackage | null>(null);
const [currentOperation, setCurrentOperation] = createSignal<{
  type: 'install' | 'uninstall' | 'update' | 'update-all';
  packageName: string;
  bucket?: string;
  id: string; // Simple operation ID to avoid race conditions
} | null>(null);
const closeHandlers = new Set<(wasSuccess: boolean) => void>();

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
    } else {
      // Handle non-Scoop installation
      console.warn('Pailer is not installed via Scoop, cannot use self-update');
      const message = t('pailerUpdate.notScoopInstall');
      showWarningNotification(message);
      return true; // Block normal update flow
    }
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

const showWarningNotification = (message: string) => {
  console.warn('Pailer Warning:', message);
  toast.warning(message);
};

const addCloseListener = (handler: (wasSuccess: boolean) => void) => {
  closeHandlers.add(handler);
  return () => {
    closeHandlers.delete(handler);
  };
};

const performInstall = (pkg: ScoopPackage) => {
  // Ensure clean state before starting new operation
  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  // Track current operation
  const operationId = `install-${pkg.name}-${Math.floor(Date.now() / 1000)}`;
  setCurrentOperation({
    type: 'install',
    packageName: pkg.name,
    bucket: pkg.source,
    id: operationId,
  });

  const title = t('packageInfo.installing', { name: pkg.name });
  setOperationTitle(title);

  addOperation({
    id: operationId,
    title,
    status: OperationStatus.InProgress,
    isMinimized: false,
    output: [],
    isScan: false,
    operationType: OperationType.Install,
    packageName: pkg.name,
  } as Parameters<typeof addOperation>[0]);

  invoke('install_package', {
    packageName: pkg.name,
    bucket: pkg.source,
    operationId,
  }).catch((err) => {
    console.error(`Installation invocation failed for ${pkg.name}:`, err);
    setOperationNextStep(null);
    setCurrentOperation(null);
  });
};

const handleInstall = (pkg: ScoopPackage) => {
  if (installedPackagesStore.packages().some((p) => p.name === pkg.name)) {
    setOperationNextStep({
      buttonLabel: 'OK',
      onNext: () => setOperationNextStep(null),
    } as OperationNextStep);
    return;
  }

  performInstall(pkg);
};

const handleInstallConfirm = () => {
  const pkg = pendingInstallPackage();
  if (pkg) {
    performInstall(pkg);
    setPendingInstallPackage(null);
  }
};

const handleUninstall = (pkg: ScoopPackage) => {
  // Ensure clean state before starting new operation
  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  // Track current operation
  const operationId = `uninstall-${pkg.name}-${Math.floor(Date.now() / 1000)}`;
  setCurrentOperation({
    type: 'uninstall',
    packageName: pkg.name,
    bucket: pkg.source,
    id: operationId,
  });

  const title = t('packageInfo.uninstalling', { name: pkg.name });
  setOperationTitle(title);

  addOperation({
    id: operationId,
    title,
    status: OperationStatus.InProgress,
    isMinimized: false,
    output: [],
    isScan: false,
    operationType: OperationType.Uninstall,
    packageName: pkg.name,
  } as Parameters<typeof addOperation>[0]);

  invoke('uninstall_package', {
    packageName: pkg.name,
    bucket: pkg.source,
    operationId,
  }).catch((err) => {
    console.error(`Uninstallation invocation failed for ${pkg.name}:`, err);
    setOperationNextStep(null);
    setCurrentOperation(null);
  });
};

const handleUpdate = async (pkg: ScoopPackage) => {
  if (await checkAndSetupPailerSelfUpdate(pkg, 'update')) {
    return;
  }

  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  const operationId = `update-${pkg.name}-${Math.floor(Date.now() / 1000)}`;
  setCurrentOperation({
    type: 'update',
    packageName: pkg.name,
    bucket: pkg.source,
    id: operationId,
  });

  const title = t('packageInfo.updating', { name: pkg.name });
  setOperationTitle(title);

  addOperation({
    id: operationId,
    title,
    status: OperationStatus.InProgress,
    isMinimized: false,
    output: [],
    isScan: false,
    operationType: OperationType.Update,
    packageName: pkg.name,
  } as Parameters<typeof addOperation>[0]);

  // Call backend command with operationId
  const bypassSelfUpdate = settingsStore.settings.scoop.bypassSelfUpdate;
  invoke('update_package', { packageName: pkg.name, operationId, bypassSelfUpdate }).catch(
    (err) => {
      console.error('Update invocation failed:', err);
      setCurrentOperation(null);
    }
  );
};

const handleForceUpdate = async (pkg: ScoopPackage) => {
  if (await checkAndSetupPailerSelfUpdate(pkg, 'force-update')) {
    return;
  }

  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  const operationId = `force-update-${pkg.name}-${Math.floor(Date.now() / 1000)}`;
  setCurrentOperation({
    type: 'update',
    packageName: pkg.name,
    bucket: pkg.source,
    id: operationId,
  });

  const title = t('packageInfo.forceUpdating', { name: pkg.name });
  setOperationTitle(title);

  addOperation({
    id: operationId,
    title,
    status: OperationStatus.InProgress,
    isMinimized: false,
    output: [],
    isScan: false,
    operationType: OperationType.Update,
    packageName: pkg.name,
  } as Parameters<typeof addOperation>[0]);

  const bypassSelfUpdate = settingsStore.settings.scoop.bypassSelfUpdate;
  invoke('update_package', {
    packageName: pkg.name,
    force: true,
    operationId,
    bypassSelfUpdate,
  }).catch((err) => {
    console.error('Force update invocation failed:', err);
    setCurrentOperation(null);
  });
};

const handleUpdateAll = () => {
  // Ensure clean state before starting new operation
  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  // Track current operation
  const operationId = `update-all-${Math.floor(Date.now() / 1000)}`;
  setCurrentOperation({
    type: 'update-all',
    packageName: 'all-packages',
    id: operationId,
  });

  const title = t('buttons.updateAll');
  setOperationTitle(title);

  addOperation({
    id: operationId,
    title,
    status: OperationStatus.InProgress,
    isMinimized: false,
    output: [],
    isScan: false,
    operationType: OperationType.UpdateAll,
    packageName: 'all-packages',
  } as Parameters<typeof addOperation>[0]);

  // Call backend command
  invoke('update_all_packages', { operationId }).catch((err) => {
    console.error('Update all invocation failed:', err);
    setCurrentOperation(null);
  });
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
  console.log('Pailer self-update cancelled by user');
  setPailerUpdateConfirmOpen(false);
  setPendingPailerUpdate(null);
};

const closeOperationModal = (wasSuccess: boolean) => {
  console.log('🎯🎯🎯 closeOperationModal FINALLY called with:', { wasSuccess });

  // Clear all operation states to ensure clean slate for next operation
  setOperationTitle(null);
  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  const operation = currentOperation();

  if (wasSuccess && operation) {
    console.log(
      `Package operation completed successfully: ${operation.type} - ${operation.packageName}`
    );

    // Silent refresh to avoid loading UI
    console.log('🔄 Calling installedPackagesStore.silentRefetch()');
    installedPackagesStore.silentRefetch();
    console.log('✅ silentRefetch completed');
    // Search cache invalidation
    console.log('🗑️ Invalidating search cache');
    searchCacheManager.invalidateCache();
    console.log('✅ Search cache invalidated');
  } else if (operation) {
    console.log(`Package operation failed: ${operation.type} - ${operation.packageName}`);
  }

  closeHandlers.forEach((handler) => handler(wasSuccess));
};

export function usePackageOperations(): UsePackageOperationsReturn {
  return {
    operationTitle,
    setOperationTitle,
    operationNextStep,
    isScanning,
    pendingInstallPackage,
    handleInstall,
    handleInstallConfirm,
    handleUninstall,
    handleUpdate,
    handleForceUpdate,
    handleUpdateAll,
    closeOperationModal,
    addCloseListener,
    // Pailer self-update confirmation
    pailerUpdateConfirmOpen,
    setPailerUpdateConfirmOpen,
    pailerUpdateType,
    handlePailerUpdateConfirm,
    handlePailerUpdateCancel,
  };
}
