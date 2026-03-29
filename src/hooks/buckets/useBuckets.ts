import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage } from '../../types/scoop';

// Cache for bucket manifests
interface ManifestCache {
  manifests: string[];
  timestamp: number;
  bucketName: string;
}

const MANIFEST_CACHE_PREFIX = 'bucket_manifests_';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Helper function to create safe cache keys
const getCacheKey = (bucketName: string): string => {
  const safeName = bucketName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  return `${MANIFEST_CACHE_PREFIX}${safeName}`;
};

// Helper functions for manifest cache
const getManifestCache = (bucketName: string): ManifestCache | null => {
  try {
    const cacheKey = getCacheKey(bucketName);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed: ManifestCache = JSON.parse(cached);
      // Check if cache is still valid
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed;
      }
      // Remove expired cache
      localStorage.removeItem(cacheKey);
    }
  } catch (error) {
    console.error('Failed to read manifest cache:', error);
  }
  return null;
};

const setManifestCache = (bucketName: string, manifests: string[]): void => {
  try {
    const cache: ManifestCache = {
      manifests,
      timestamp: Date.now(),
      bucketName,
    };
    const cacheKey = getCacheKey(bucketName);
    localStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to set manifest cache:', error);
  }
};

const clearManifestCache = (bucketName?: string): void => {
  try {
    if (bucketName) {
      const cacheKey = getCacheKey(bucketName);
      localStorage.removeItem(cacheKey);
    } else {
      // Clear all manifest caches
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(MANIFEST_CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Failed to clear manifest cache:', error);
  }
};

export interface BucketInfo {
  name: string;
  path: string;
  manifest_count: number;
  is_git_repo: boolean;
  git_url?: string;
  git_branch?: string;
  last_updated?: string;
}

interface UseBucketsReturn {
  buckets: () => BucketInfo[];
  loading: () => boolean;
  error: () => string | null;
  fetchBuckets: (forceRefresh?: boolean, quiet?: boolean) => Promise<void>;
  markForRefresh: () => void;
  getBucketInfo: (bucketName: string) => Promise<BucketInfo | null>;
  getBucketManifests: (bucketName: string, forceRefresh?: boolean) => Promise<string[]>;
  clearManifestCache: (bucketName?: string) => void;
  cleanup: () => void;
}

let cachedBuckets: BucketInfo[] | null = null;
let isFetching = false;
let globalError: string | null = null;
const listeners: ((buckets: BucketInfo[]) => void)[] = [];

// Add a function to update the cache from outside the hook
export function updateBucketsCache(buckets: BucketInfo[] | null) {
  cachedBuckets = buckets;

  // Notify all listeners of the cache update
  listeners.forEach((listener) => listener(buckets || []));
}

// Export cache functions for external use
export { clearManifestCache, getManifestCache, setManifestCache };

export function useBuckets(): UseBucketsReturn {
  // Initialize with cached data if available to avoid unnecessary loading state on page switches
  const [buckets, setBuckets] = createSignal<BucketInfo[]>(cachedBuckets || []);
  const [loading, setLoading] = createSignal(isFetching || !cachedBuckets);
  const [error, setError] = createSignal<string | null>(globalError);

  const notifyListeners = (newBuckets: BucketInfo[]) => {
    listeners.forEach((listener) => listener(newBuckets));
  };

  const subscribe = (listener: (buckets: BucketInfo[]) => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  };

  let shouldRefreshCache = false;

  const fetchBuckets = async (forceRefresh = false, quiet = false) => {
    if (isFetching && !forceRefresh) {
      return;
    }

    // If we have cached data and it's not a force refresh, use it immediately
    // This ensures the UI shows cached data even if we're still fetching in the background
    if (cachedBuckets && !forceRefresh && !shouldRefreshCache) {
      setBuckets(cachedBuckets);
      if (!quiet) {
        setLoading(false);
      }
      return;
    }

    if (!quiet) {
      setLoading(true);
      notifyListeners(buckets());
    }
    isFetching = true;
    setError(null);

    try {
      const result = await invoke<BucketInfo[]>('get_buckets');
      cachedBuckets = result;
      globalError = null;
      shouldRefreshCache = false;
      setBuckets(result);
      setError(null);
      notifyListeners(result);
    } catch (err) {
      console.error('Failed to fetch buckets:', err);
      const errMsg = err as string;
      globalError = errMsg;
      setError(errMsg);
      // Notify listeners to sync loading and error state
      notifyListeners(buckets());
    } finally {
      isFetching = false;
      if (!quiet) {
        setLoading(false);
        notifyListeners(buckets());
      } else {
        // Even if quiet, we should notify listeners so they can sync their loading state
        notifyListeners(buckets());
      }
    }
  };

  const markForRefresh = () => {
    shouldRefreshCache = true;
    // Clear all manifest caches when buckets need refresh
    clearManifestCache();
  };

  const unsubscribe = subscribe((newBuckets) => {
    setBuckets(newBuckets);
    // Sync loading state with the global isFetching state
    setLoading(isFetching);
    // Sync error state with the global error state
    setError(globalError);
  });

  // Return cleanup function instead of using onCleanup directly
  const cleanup = () => {
    unsubscribe();
  };

  const getBucketInfo = async (bucketName: string): Promise<BucketInfo | null> => {
    try {
      return await invoke<BucketInfo>('get_bucket_info', { bucketName });
    } catch (err) {
      console.error(`Failed to get info for bucket ${bucketName}:`, err);
      return null;
    }
  };

  const getBucketManifests = async (
    bucketName: string,
    forceRefresh = false
  ): Promise<string[]> => {
    // Try to get from cache first (unless force refresh is requested)
    if (!forceRefresh) {
      const cached = getManifestCache(bucketName);
      if (cached) {
        console.log(`Using cached manifests for bucket: ${bucketName}`);
        return cached.manifests;
      }
    }

    try {
      console.log(`Fetching manifests from backend for bucket: ${bucketName}`);
      const manifests = await invoke<string[]>('get_bucket_manifests', { bucketName });

      // Cache the results
      setManifestCache(bucketName, manifests);

      return manifests;
    } catch (err) {
      console.error(`Failed to get manifests for bucket ${bucketName}:`, err);
      return [];
    }
  };

  return {
    buckets,
    loading,
    error,
    fetchBuckets,
    markForRefresh,
    getBucketInfo,
    getBucketManifests,
    clearManifestCache,
    cleanup,
  };
}

/**
 * Create a temporary ScoopPackage object for displaying package info
 * This is used when clicking on packages in bucket manifests that may not be installed
 */
export function createTemporaryPackage(packageName: string, bucketName: string): ScoopPackage {
  return {
    name: packageName,
    version: '', // Will be fetched by package info
    source: bucketName,
    updated: '', // Will be fetched by package info
    is_installed: false, // Will be determined by package info
    info: '', // Will be fetched by package info
    match_source: 'name',
    available_version: undefined,
    installation_type: 'standard',
    has_multiple_versions: false,
  };
}

function buildTemporaryPackage(packageName: string, bucketName: string): ScoopPackage {
  return {
    name: packageName,
    version: '',
    source: bucketName,
    updated: '',
    is_installed: false,
    info: '',
    match_source: 'name',
    available_version: undefined,
    installation_type: 'standard',
    has_multiple_versions: false,
  };
}

/**
 * Resolve installed package for a clicked bucket package.
 * Priority:
 * 1) Use caller-provided installed packages when available.
 * 2) Fallback to querying installed packages from backend.
 */
async function resolveInstalledPackage(
  packageName: string,
  bucketName: string,
  installedPackages?: ScoopPackage[]
): Promise<ScoopPackage | undefined> {
  let installedList = installedPackages;
  if (!installedList) {
    try {
      installedList = await invoke<ScoopPackage[]>('get_installed_packages_full');
    } catch (err) {
      console.warn('Failed to resolve installed packages for bucket package click:', err);
      return undefined;
    }
  }

  return installedList.find((p) => p.name === packageName && p.source === bucketName);
}

/**
 * Handle package click from bucket manifests
 * Creates a temporary package object and opens package info modal
 */
export async function handleBucketPackageClick(
  packageName: string,
  bucketName: string,
  fetchPackageInfo: (pkg: ScoopPackage) => Promise<void>,
  closeBucketModal?: () => void,
  installedPackages?: ScoopPackage[] // Optional list of installed packages to check
) {
  // Only treat the package as installed when installed source matches clicked bucket.
  const installedPkg = await resolveInstalledPackage(packageName, bucketName, installedPackages);

  // Create package object with correct installation status
  const pkg: ScoopPackage = installedPkg
    ? {
        ...installedPkg,
        source: bucketName,
        is_installed: true,
      }
    : buildTemporaryPackage(packageName, bucketName);

  // Fetch package info (this will open the PackageInfoModal)
  await fetchPackageInfo(pkg);

  // Optionally close the bucket modal (for InstalledPage behavior)
  if (closeBucketModal) {
    closeBucketModal();
  }
}
