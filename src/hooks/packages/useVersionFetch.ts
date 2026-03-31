import versionedPackagesStore from '../../stores/versionedPackagesStore';

export function useVersionFetch() {
  const ensureVersionsLoaded = (packageName: string, global: boolean = false) => {
    // Store has internal isLoading guard, no need for pre-check
    return versionedPackagesStore.fetchPackageVersions(packageName, global).catch(console.error);
  };

  return {
    ensureVersionsLoaded,
  };
}
