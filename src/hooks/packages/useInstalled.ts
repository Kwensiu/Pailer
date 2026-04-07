import { createSignal, createMemo } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage, VersionTypeFilter } from '../../types/scoop';
import { usePackageOperations } from './usePackageOps';
import { usePackageInfo } from './usePackageInfo';
import { createLocalStorageSignal } from '../storage/createLocalStorageSignal';
import installedPackagesStore from '../../stores/installedPackagesStore';
import heldStore from '../../stores/held';
import { useBuckets } from '../buckets/useBuckets';
import versionedPackagesStore from '../../stores/versionedPackagesStore';
import { searchCacheManager } from '../search/useSearchCache';
import { toast } from '../../components/common/ToastAlert';
import { t } from '../../i18n';

type SortKey = 'name' | 'version' | 'source' | 'updated';

const getSortValue = (pkg: ScoopPackage, sortKey: SortKey): string => {
  switch (sortKey) {
    case 'name':
      return (pkg.name || '').toLowerCase();
    case 'version':
      return (pkg.version || '').toLowerCase();
    case 'source':
      return (pkg.source || '').toLowerCase();
    case 'updated':
      return (pkg.updated || '').toLowerCase();
    default:
      return '';
  }
};

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
  const [selectedVersionType, setSelectedVersionType] = createLocalStorageSignal<VersionTypeFilter>(
    'installed-selected-version-type',
    'all'
  );

  const [changeBucketModalOpen, setChangeBucketModalOpen] = createSignal(false);
  const [currentPackageForBucketChange, setCurrentPackageForBucketChange] =
    createSignal<ScoopPackage | null>(null);
  const [newBucketName, setNewBucketName] = createSignal('');
  const [autoShowVersions, setAutoShowVersions] = createSignal(false);

  const handleFetchPackageInfoForVersions = (pkg: ScoopPackage) => {
    // If clicking the same package, close and reset
    if (packageInfo.selectedPackage()?.name === pkg.name) {
      setAutoShowVersions(false);
      packageInfo.closeModal();
      return;
    }
    setAutoShowVersions(true);
    packageInfo.fetchPackageInfo(pkg);
  };

  const handleFetchPackageInfo = (pkg: ScoopPackage) => {
    // If clicking the same package, close and reset
    if (packageInfo.selectedPackage()?.name === pkg.name) {
      setAutoShowVersions(false);
      packageInfo.closeModal();
      return;
    }
    setAutoShowVersions(false);
    packageInfo.fetchPackageInfo(pkg);
  };

  const handleCloseInfoModalWithVersions = () => {
    setAutoShowVersions(false);
    packageInfo.closeModal();
  };

  const handleSwitchVersion = async (pkg: ScoopPackage, targetVersion: string) => {
    setOperatingOn(pkg.name);
    try {
      await invoke<string>('switch_package_version', {
        packageName: pkg.name,
        targetVersion,
        global: false,
      });

      await installedPackagesStore.silentRefetch();
      toast.success(
        t('packageInfo.success.switchVersion', { name: pkg.name, version: targetVersion })
      );

      // Non-critical operations: handle failures independently
      try {
        await versionedPackagesStore.fetchPackageVersions(pkg.name, false);
      } catch (versionErr) {
        console.warn(`Failed to refresh version list for ${pkg.name}:`, versionErr);
      }

      try {
        await searchCacheManager.invalidateCache();
      } catch (cacheErr) {
        console.warn('Failed to invalidate search cache:', cacheErr);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to switch ${pkg.name} to version ${targetVersion}:`, errorMsg);
      toast.error(
        t('packageInfo.errorSwitchingVersion', { version: targetVersion, error: errorMsg })
      );
    } finally {
      setOperatingOn(null);
    }
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
    await refetch();
  };

  const hasUpdate = (pkg: ScoopPackage): boolean =>
    !!pkg.available_version &&
    !!pkg.name &&
    !heldStore.isHeld(pkg.name) &&
    pkg.installation_type !== 'custom';

  const processedPackages = createMemo(() => {
    let pkgs = [...installedPackagesStore.packages()];
    if (selectedBucket() !== 'all') {
      pkgs = pkgs.filter((p) => p.source === selectedBucket());
    }
    if (selectedVersionType() === 'versioned') {
      pkgs = pkgs.filter((p) => p.installation_type === 'versioned');
    }
    if (selectedVersionType() === 'held') {
      pkgs = pkgs.filter((p) => p.name && heldStore.isHeld(p.name));
    }
    const key = sortKey();
    const direction = sortDirection();
    const sortedPkgs = [...pkgs];
    sortedPkgs.sort((a, b) => {
      const aHasUpdate = hasUpdate(a);
      const bHasUpdate = hasUpdate(b);
      if (aHasUpdate && !bHasUpdate) return -1;
      if (!aHasUpdate && bHasUpdate) return 1;

      const valA = getSortValue(a, key);
      const valB = getSortValue(b, key);
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortedPkgs;
  });

  const updatableCount = () => installedPackagesStore.packages().filter(hasUpdate).length;

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
    selectedVersionType,
    setSelectedVersionType,
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
    handleSwitchVersion,
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
    updateSelectedPackage: packageInfo.updateSelectedPackage,
    syncSelectedPackage: packageInfo.syncSelectedPackage,
    refreshSelectedPackageInfo: packageInfo.refreshSelectedPackageInfo,
    info: packageInfo.info,
    hasVersions: installedPackagesStore.hasVersions,
    handleUpdate: packageOperations.handleUpdate,
    handleForceUpdate: packageOperations.handleForceUpdate,
    handleUpdateAll: packageOperations.handleUpdateAll,
    handleUninstall: packageOperations.handleUninstall,
    autoShowVersions,
  };
}
