import { createSignal, createRoot } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage, UpdatablePackage } from '../types/scoop';
import heldStore from './held';

export interface DisplayPackage extends ScoopPackage {
  available_version?: string;
}

function createInstalledPackagesStore() {
  const [packages, setPackages] = createSignal<DisplayPackage[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [uniqueBuckets, setUniqueBuckets] = createSignal<string[]>(['all']);
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = createSignal(false);
  const [versionedPackages, setVersionedPackages] = createSignal<string[]>([]);

  const mergeExistingUpdateInfo = (nextPackages: ScoopPackage[]): DisplayPackage[] => {
    // Create a map of existing update info to preserve it during refresh
    // This prevents losing update availability when packages are refreshed
    const previousUpdateMap = new Map(
      packages()
        .filter((pkg) => pkg.available_version)
        .map((pkg) => [pkg.name, pkg.available_version])
    );

    // Merge new package list with existing update info
    return nextPackages.map((pkg) => ({
      ...pkg,
      // Preserve update info if package exists in previous list
      available_version: previousUpdateMap.get(pkg.name),
    }));
  };

  const checkForUpdates = async () => {
    setIsCheckingForUpdates(true);
    try {
      const updatable = await invoke<UpdatablePackage[]>('check_for_updates');
      const updatableMap = new Map(updatable.map((p) => [p.name, p.available]));

      setPackages((pkgs) =>
        pkgs.map((p) => ({
          ...p,
          available_version: updatableMap.get(p.name),
        }))
      );
    } catch (err) {
      console.error('Failed to check for updates:', err);
      setError('Failed to check for updates');
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  const fetchVersionedPackages = async () => {
    try {
      const versioned = await invoke<string[]>('get_versioned_packages', {
        global: false, // Global packages not yet supported
      });
      setVersionedPackages(versioned);
    } catch (err) {
      console.error('Failed to fetch versioned packages:', err);
    }
  };

  // Initial fetch - only runs if data hasn't been loaded yet
  // This prevents unnecessary refetches when data is already available
  const fetchInstalledPackages = async () => {
    if (isLoaded() || loading()) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const installedPackages = await invoke<ScoopPackage[]>('get_installed_packages_full');
      setPackages(mergeExistingUpdateInfo(installedPackages));
      const buckets = new Set<string>(installedPackages.map((p) => p.source));
      setUniqueBuckets(['all', ...Array.from(buckets).sort()]);
      setIsLoaded(true);

      await Promise.all([heldStore.refetch(), checkForUpdates(), fetchVersionedPackages()]);
    } catch (err) {
      console.error('Failed to fetch installed packages:', err);
      setError('Failed to load installed packages');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  // Force refetch - always refreshes data regardless of current state
  // Resets isLoaded flag to allow fresh data fetch
  const refetch = async () => {
    setIsLoaded(false);
    setLoading(true);
    setError(null);
    try {
      const installedPackages = await invoke<ScoopPackage[]>('refresh_installed_packages', {
        force: true,
      });
      setPackages(mergeExistingUpdateInfo(installedPackages));
      const buckets = new Set<string>(installedPackages.map((p) => p.source));
      setUniqueBuckets(['all', ...Array.from(buckets).sort()]);
      setIsLoaded(true);

      await Promise.all([heldStore.refetch(), checkForUpdates(), fetchVersionedPackages()]);
    } catch (err) {
      console.error('Failed to refresh installed packages:', err);
      setError('Failed to refresh installed packages');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  // Silent refetch - refreshes data without showing loading UI
  // Used after operations complete to update the list in the background
  const silentRefetch = async () => {
    setError(null);
    try {
      // Parallel fetch package data and update info
      const [installedPackages, updateInfo] = await Promise.all([
        invoke<ScoopPackage[]>('refresh_installed_packages', { force: true }),
        invoke<UpdatablePackage[]>('check_for_updates').catch(() => []),
      ]);

      // One-time merge data
      const packagesWithUpdates = installedPackages.map((pkg) => ({
        ...pkg,
        available_version: updateInfo.find((u) => u.name === pkg.name)?.available,
      }));

      // One-time set complete data
      setPackages(packagesWithUpdates);
      const buckets = new Set<string>(installedPackages.map((p) => p.source));
      setUniqueBuckets(['all', ...Array.from(buckets).sort()]);
      setIsLoaded(true);

      // Silently update other states
      await Promise.all([heldStore.refetch(), fetchVersionedPackages()]);
    } catch (err) {
      console.error('Failed to silently refresh installed packages:', err);
      setError('Failed to refresh installed packages');
      setPackages([]);
    }
  };

  const hasVersions = (packageName: string) => {
    const result = versionedPackages().includes(packageName);
    return result;
  };

  return {
    packages,
    loading,
    error,
    uniqueBuckets,
    isLoaded,
    isCheckingForUpdates,
    versionedPackages,
    hasVersions,
    fetch: fetchInstalledPackages,
    refetch,
    silentRefetch,
    checkForUpdates,
    fetchVersionedPackages,
  };
}

export default createRoot(createInstalledPackagesStore);
