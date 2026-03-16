import { createSignal, createRoot } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

export interface VersionInfo {
  version: string;
  is_current: boolean;
}

export interface PackageVersions {
  packageName: string;
  currentVersion: string;
  availableVersions: VersionInfo[];
}

function createVersionedPackagesStore() {
  const [packageVersions, setPackageVersions] = createSignal<Map<string, PackageVersions>>(
    new Map()
  );
  const [loading, setLoading] = createSignal<Set<string>>(new Set());
  const [errors, setErrors] = createSignal<Map<string, string>>(new Map());

  const isLoading = (packageName: string) => loading().has(packageName);
  const getError = (packageName: string) => errors().get(packageName) || null;
  const getPackageVersions = (packageName: string) => packageVersions().get(packageName) || null;

  const fetchPackageVersions = async (packageName: string, global: boolean = false) => {
    if (isLoading(packageName)) return;

    setLoading((prev) => new Set<string>([...prev, packageName]));
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(packageName);
      return next;
    });

    try {
      const result = await invoke<{
        current_version: string;
        available_versions: VersionInfo[];
      }>('get_package_versions', {
        packageName,
        global,
      });

      const packageVersionData: PackageVersions = {
        packageName,
        currentVersion: result.current_version,
        availableVersions: result.available_versions,
      };

      setPackageVersions((prev) => {
        const next = new Map(prev);
        next.set(packageName, packageVersionData);
        return next;
      });

      return packageVersionData;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setErrors((prev) => {
        const next = new Map(prev);
        next.set(packageName, errorMsg);
        return next;
      });
      console.error(`Failed to fetch versions for ${packageName}:`, errorMsg);
      throw err;
    } finally {
      setLoading((prev) => {
        const next = new Set<string>(prev);
        next.delete(packageName);
        return next;
      });
    }
  };

  const removePackageVersions = (packageName: string) => {
    setPackageVersions((prev) => {
      const next = new Map(prev);
      next.delete(packageName);
      return next;
    });
  };

  const clearAll = () => {
    setPackageVersions(new Map());
    setLoading(new Set<string>());
    setErrors(new Map());
  };

  return {
    packageVersions,
    isLoading,
    getError,
    getPackageVersions,
    fetchPackageVersions,
    removePackageVersions,
    clearAll,
  };
}

export default createRoot(createVersionedPackagesStore);
