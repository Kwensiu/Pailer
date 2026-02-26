import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage } from '../types/scoop';
import { OperationNextStep } from '../types/operations';
import installedPackagesStore from '../stores/installedPackagesStore';
import { useOperations } from '../stores/operations';

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

  const title = `Installing ${pkg.name}`;
  setOperationTitle(title);

  addOperation({
    id: `install-${pkg.name}-${Math.floor(Date.now() / 1000)}`,
    title,
    status: 'in-progress',
    isMinimized: false,
    output: [],
  });

  invoke('install_package', {
    packageName: pkg.name,
    bucket: pkg.source,
  }).catch((err) => {
    console.error(`Installation invocation failed for ${pkg.name}:`, err);
    setOperationNextStep(null);
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

  const title = `Uninstalling ${pkg.name}`;
  setOperationTitle(title);

  addOperation({
    id: `uninstall-${pkg.name}-${Math.floor(Date.now() / 1000)}`,
    title,
    status: 'in-progress',
    isMinimized: false,
    output: [],
  });

  invoke('uninstall_package', {
    packageName: pkg.name,
    bucket: pkg.source,
  }).catch((err) => {
    console.error(`Uninstallation invocation failed for ${pkg.name}:`, err);
    setOperationNextStep(null);
  });
};

const handleUpdate = (pkg: ScoopPackage) => {
  // Ensure clean state before starting new operation
  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  const title = `Updating ${pkg.name}`;
  setOperationTitle(title);

  const operationId = `update-${pkg.name}-${Math.floor(Date.now() / 1000)}`;

  addOperation({
    id: operationId,
    title,
    status: 'in-progress',
    isMinimized: false,
    output: [],
  });

  invoke('update_package', { packageName: pkg.name }).catch((err) => {
    console.error('Update invocation failed:', err);
  });
};

const handleForceUpdate = (pkg: ScoopPackage) => {
  // Ensure clean state before starting new operation
  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  const title = `Force Updating ${pkg.name}`;
  setOperationTitle(title);

  addOperation({
    id: `force-update-${pkg.name}-${Math.floor(Date.now() / 1000)}`,
    title,
    status: 'in-progress',
    isMinimized: false,
    output: [],
  });

  invoke('update_package', { packageName: pkg.name, force: true }).catch((err) => {
    console.error('Force update invocation failed:', err);
  });
};

const handleUpdateAll = () => {
  // Ensure clean state before starting new operation
  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  const title = 'Updating all packages';
  setOperationTitle(title);

  const operationId = `update-all-${Math.floor(Date.now() / 1000)}`;

  addOperation({
    id: operationId,
    title,
    status: 'in-progress',
    isMinimized: false,
    output: [],
  });

  // 调用后端命令
  invoke('update_all_packages').catch((err) => {
    console.error('Update all invocation failed:', err);
  });
};

const closeOperationModal = (wasSuccess: boolean) => {
  // Clear all operation states to ensure clean slate for next operation
  setOperationTitle(null);
  setOperationNextStep(null);
  setIsScanning(false);
  setPendingInstallPackage(null);

  if (wasSuccess) {
    installedPackagesStore.fetch();
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
