import { createSignal, createMemo } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage } from '../types/scoop';
import { usePackageOperations } from './usePackageOperations';
import { usePackageInfo } from './usePackageInfo';
import { createLocalStorageSignal } from './createLocalStorageSignal';
import installedPackagesStore from '../stores/installedPackagesStore';
import heldStore from '../stores/held';
import { useBuckets } from './useBuckets';

type SortKey = 'name' | 'version' | 'source' | 'updated';

export function useInstalledPackages() {
  const { loading, error, uniqueBuckets, isCheckingForUpdates, fetch, refetch } =
    installedPackagesStore;
  const [operatingOn, setOperatingOn] = createSignal<string | null>(null);
  const [scoopStatus, setScoopStatus] = createSignal<any>(null);
  const [statusLoading, setStatusLoading] = createSignal(false);
  const [statusError, setStatusError] = createSignal<string | null>(null);

  const packageOperations = usePackageOperations();
  const packageInfo = usePackageInfo();
  const { buckets } = useBuckets();

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

  const handleCloseInfoModalWithVersions = () => {};

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
      const status = await invoke<any>('check_scoop_status');
      setScoopStatus(status);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Scoop status check failed:', errorMsg);
      setStatusError(`Error checking status: ${errorMsg}`);
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

  const processedPackages = createMemo(() => {
    let pkgs = [...installedPackagesStore.packages()];
    if (selectedBucket() !== 'all') {
      pkgs = pkgs.filter((p) => p.source === selectedBucket());
    }
    const key = sortKey();
    const direction = sortDirection();
    const sortedPkgs = [...pkgs];
    sortedPkgs.sort((a, b) => {
      const aHasUpdate =
        !!a.available_version && !heldStore.isHeld(a.name) && a.installation_type === 'standard';
      const bHasUpdate =
        !!b.available_version && !heldStore.isHeld(b.name) && b.installation_type === 'standard';
      if (aHasUpdate && !bHasUpdate) return -1;
      if (!aHasUpdate && bHasUpdate) return 1;

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
    fetchInstalledPackages: fetch,
    handleForceRefresh,
    checkForUpdates,

    changeBucketModalOpen,
    setChangeBucketModalOpen,
    currentPackageForBucketChange,
    newBucketName,
    setNewBucketName,
    handleChangeBucketConfirm,
    handleChangeBucketCancel,

    buckets,

    selectedPackage: packageInfo.selectedPackage,
    info: packageInfo.info,
    isPackageVersioned: installedPackagesStore.isPackageVersioned,
    handleUpdate: packageOperations.handleUpdate,
    handleForceUpdate: packageOperations.handleForceUpdate,
    handleUpdateAll: packageOperations.handleUpdateAll,
    handleUninstall: packageOperations.handleUninstall,
    autoShowVersions: () => false,
  };
}
