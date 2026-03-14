import { createSignal, createMemo } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage } from '../types/scoop';
import { usePackageOperations } from './usePackageOperations';
import { usePackageInfo } from './usePackageInfo';
import { createLocalStorageSignal } from './createLocalStorageSignal';
import installedPackagesStore from '../stores/installedPackagesStore';
import heldStore from '../stores/held';
import { searchCacheManager } from './useSearchCache';
import { useBuckets } from './useBuckets';

type SortKey = 'name' | 'version' | 'source' | 'updated';

export function useInstalledPackages() {
  const { loading, error, uniqueBuckets, isCheckingForUpdates, fetch, refetch } =
    installedPackagesStore;
  const [operatingOn, setOperatingOn] = createSignal<string | null>(null);
  const [scoopStatus, setScoopStatus] = createSignal<any>(null);
  const [statusLoading, setStatusLoading] = createSignal(false);
  const [statusError, setStatusError] = createSignal<string | null>(null);

  // Use shared hooks
  const packageOperations = usePackageOperations();
  const packageInfo = usePackageInfo();
  const { buckets } = useBuckets();

  // Local storage for view mode and sort preferences
  const [viewMode, setViewMode] = createLocalStorageSignal<'grid' | 'list'>(
    'installed-view-mode',
    'grid'
  );
  const [sortKey, setSortKey] = createLocalStorageSignal<SortKey>('installed-sort-key', 'name');
  const [sortDirection, setSortDirection] = createLocalStorageSignal<'asc' | 'desc'>(
    'installed-sort-direction',
    'asc'
  );
  const [selectedBucket, setSelectedBucket] = createLocalStorageSignal<string>(
    'installed-selected-bucket',
    'all'
  );

  // Change bucket modal state
  const [changeBucketModalOpen, setChangeBucketModalOpen] = createSignal(false);
  const [currentPackageForBucketChange, setCurrentPackageForBucketChange] =
    createSignal<ScoopPackage | null>(null);
  const [newBucketName, setNewBucketName] = createSignal('');

  const handleFetchPackageInfoForVersions = (pkg: ScoopPackage) => {
    packageInfo.fetchPackageInfo(pkg);
  };

  const handleFetchPackageInfo = (pkg: ScoopPackage) => {
    packageInfo.fetchPackageInfo(pkg);
  };

  const handleCloseInfoModalWithVersions = () => {
    // Do nothing for now
  };

  const handleSort = (key: SortKey) => {
    if (sortKey() === key) {
      setSortDirection(sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const checkForUpdates = () => {
    installedPackagesStore.checkForUpdates();
  };

  const checkScoopStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const status = await invoke<any>('get_scoop_status');
      setScoopStatus(status);
    } catch (err) {
      setStatusError('Failed to check Scoop status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleHold = async (pkgName: string) => {
    setOperatingOn(pkgName);
    try {
      await invoke('hold_package', { packageName: pkgName });
    } catch (err) {
      console.error(`Failed to hold package ${pkgName}:`, err);
    } finally {
      await heldStore.refetch();
      installedPackagesStore.checkForUpdates();
      setOperatingOn(null);
    }
  };

  const handleUnhold = async (pkgName: string) => {
    setOperatingOn(pkgName);
    try {
      await invoke('unhold_package', { packageName: pkgName });
    } catch (err) {
      console.error(`Failed to unhold package ${pkgName}:`, err);
    } finally {
      await heldStore.refetch();
      installedPackagesStore.checkForUpdates();
      setOperatingOn(null);
    }
  };

  const handleOpenChangeBucket = (pkg: ScoopPackage) => {
    setCurrentPackageForBucketChange(pkg);
    setNewBucketName(pkg.source);
    setChangeBucketModalOpen(true);
  };

  const handleChangeBucketConfirm = async () => {
    const pkg = currentPackageForBucketChange();
    const newBucket = newBucketName();
    if (!pkg || !newBucket) return;

    setOperatingOn(pkg.name);
    try {
      await invoke('change_package_bucket', {
        packageName: pkg.name,
        newBucket,
      });
      await refetch();
    } catch (err) {
      console.error(`Failed to change bucket for ${pkg.name}:`, err);
    } finally {
      setOperatingOn(null);
      setChangeBucketModalOpen(false);
    }
  };

  const handleChangeBucketCancel = () => {
    setChangeBucketModalOpen(false);
  };

  const handleForceRefresh = async () => {
    console.log('🔄 Force refreshing installed packages...');
    await refetch();
  };

  const handleCloseOperationModal = async (_operationId: string, wasSuccess: boolean) => {
    console.log('🚨🚨🚨 handleCloseOperationModal FINALLY called with:', {
      _operationId,
      wasSuccess,
    });

    packageOperations.closeOperationModal(wasSuccess);

    // The refresh is already handled in packageOperations.closeOperationModal
    // So we only need to handle cache invalidation and selected package update here

    // 在操作成功后失效搜索缓存
    if (wasSuccess) {
      searchCacheManager.invalidateCache();
    }

    // Update selectedPackage if it exists
    const currentSelected = packageInfo.selectedPackage();
    if (currentSelected) {
      // Find the package in the updated list
      const updatedPackage = installedPackagesStore
        .packages()
        .find((p) => p.name === currentSelected.name);

      if (updatedPackage) {
        packageInfo.updateSelectedPackage(updatedPackage);
      } else {
        // If not found in installed packages, it might have been uninstalled.
        // We update the modal to reflect that it is no longer installed.
        const uninstalledPackage = { ...currentSelected, is_installed: false };
        packageInfo.updateSelectedPackage(uninstalledPackage);
      }
    }
  };

  const processedPackages = createMemo(() => {
    let pkgs = [...installedPackagesStore.packages()];
    if (selectedBucket() !== 'all') {
      pkgs = pkgs.filter((p) => p.source === selectedBucket());
    }
    const key = sortKey();
    const direction = sortDirection();
    const sortedPkgs = [...pkgs];
    sortedPkgs.sort((a, b) => {
      // Updatable apps always show first, regardless of sort field
      const aHasUpdate =
        !!a.available_version && !heldStore.isHeld(a.name) && a.installation_type === 'standard';
      const bHasUpdate =
        !!b.available_version && !heldStore.isHeld(b.name) && b.installation_type === 'standard';
      if (aHasUpdate && !bHasUpdate) return -1;
      if (!aHasUpdate && bHasUpdate) return 1;

      // After updatable apps sorting completed, sort by normal logic
      const valA = (a as any)[key].toLowerCase();
      const valB = (b as any)[key].toLowerCase();
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortedPkgs;
  });

  const updatableCount = () =>
    installedPackagesStore
      .packages()
      .filter(
        (p) =>
          !!p.available_version && !heldStore.isHeld(p.name) && p.installation_type === 'standard'
      ).length;

  return {
    loading,
    error,
    uniqueBuckets,
    isCheckingForUpdates,
    processedPackages,
    updatableCount,
    viewMode,
    setViewMode,
    sortKey,
    sortDirection,
    selectedBucket,
    setSelectedBucket,
    operatingOn,
    scoopStatus,
    statusLoading,
    statusError,
    checkScoopStatus,
    handleSort,
    handleHold,
    handleUnhold,
    handleOpenChangeBucket,
    handleFetchPackageInfoForVersions,
    handleFetchPackageInfo,
    handleCloseInfoModalWithVersions,
    handleCloseOperationModal,
    fetchInstalledPackages: fetch,
    handleForceRefresh,
    checkForUpdates,

    // Change bucket states
    changeBucketModalOpen,
    setChangeBucketModalOpen,
    currentPackageForBucketChange,
    newBucketName,
    setNewBucketName,
    handleChangeBucketConfirm,
    handleChangeBucketCancel,

    // Buckets for selection
    buckets,

    // Package info and operations from packageOperations
    selectedPackage: packageInfo.selectedPackage,
    info: packageInfo.info,
    setOperationTitle: packageOperations.setOperationTitle,
    operationTitle: packageOperations.operationTitle,
    operationNextStep: packageOperations.operationNextStep,
    isPackageVersioned: installedPackagesStore.isPackageVersioned,
    handleUpdate: packageOperations.handleUpdate,
    handleForceUpdate: packageOperations.handleForceUpdate,
    handleUpdateAll: packageOperations.handleUpdateAll,
    handleUninstall: packageOperations.handleUninstall,
    autoShowVersions: () => false,
  };
}
