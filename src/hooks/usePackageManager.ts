import { useInstalledPackages } from './useInstalledPackages';
import { usePackageOperations } from './usePackageOperations';
import { usePackageInfo } from './usePackageInfo';
import { useBuckets } from './useBuckets';

/**
 * Combined hook: Provides all necessary functionality for package management page
 * This is a convenience hook to avoid calling multiple related hooks repeatedly in components
 */
export function usePackageManager() {
  const installedPackages = useInstalledPackages();
  const packageOperations = usePackageOperations();
  const packageInfo = usePackageInfo();
  const buckets = useBuckets();

  return {
    // Installed packages related
    ...installedPackages,

    // Package operations related
    ...packageOperations,

    // Package info related
    ...packageInfo,

    // Buckets related
    buckets: buckets.buckets,
    fetchBuckets: buckets.fetchBuckets,
    bucketLoading: buckets.loading,
    bucketError: buckets.error,
  };
}
