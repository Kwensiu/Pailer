import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage } from '../types/scoop';
import { OperationNextStep, OperationStatus, OperationType } from '../types/operations';
import installedPackagesStore from '../stores/installedPackagesStore';
import { useOperations } from '../stores/operations';
import { searchCacheManager } from './useSearchCache';
import { t } from '../i18n';

interface UsePackageOperationsReturn {
  operationTitle: () => string | null;
  setOperationTitle: (title: string | null) => void;
  operationNextStep: () => OperationNextStep | null;
  isScanning: () => boolean;
  pendingInstallPackage: () => ScoopPackage | null;
  handleInstall: (pkg: ScoopPackage) => void;
  handleInstallConfirm: () => void;
  handleUninstall: (pkg: ScoopPackage) => void;
  handleUpdate: (pkg: ScoopPackage) => void;
  handleForceUpdate: (pkg: ScoopPackage) => void;
  handleUpdateAll: () => void;
  closeOperationModal: (wasSuccess: boolean) => void;
  addCloseListener: (handler: (wasSuccess: boolean) => void) => () => void;
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
  id: string; // 简单添加操作ID避免竞态
} | null>(null);
const closeHandlers = new Set<(wasSuccess: boolean) => void>();

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

const handleUpdate = (pkg: ScoopPackage) => {
  // Ensure clean state before starting new operation
  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  // Track current operation
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
  invoke('update_package', { packageName: pkg.name, operationId }).catch((err) => {
    console.error('Update invocation failed:', err);
    setCurrentOperation(null);
  });
};

const handleForceUpdate = (pkg: ScoopPackage) => {
  // Ensure clean state before starting new operation
  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  // Track current operation
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

  invoke('update_package', { packageName: pkg.name, force: true, operationId }).catch((err) => {
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
  };
}
