import { createSignal, getOwner, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage } from '../../types/scoop';

// Cache for bucket manifests
interface ManifestCache {
  manifests: string[];
  timestamp: number;
  bucketName: string;
}

export interface BucketManifestPage {
  manifests: string[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

interface BucketManifestCount {
  bucket_name: string;
  manifest_count: number;
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
  manifest_count_loaded?: boolean;
  is_git_repo: boolean;
  git_url?: string;
  git_branch?: string;
  last_updated?: string;
  details_loaded?: boolean;
}

interface UseBucketsReturn {
  buckets: () => BucketInfo[];
  loading: () => boolean;
  error: () => string | null;
  fetchBuckets: (forceRefresh?: boolean, quiet?: boolean) => Promise<void>;
  fetchBucketSummaries: (forceRefresh?: boolean, quiet?: boolean) => Promise<void>;
  preloadBucketDetails: () => Promise<void>;
  markForRefresh: () => void;
  getBucketInfo: (bucketName: string) => Promise<BucketInfo | null>;
  hydrateBucketManifestCounts: (bucketNames: string[]) => Promise<BucketInfo[]>;
  hydrateBucketInfo: (bucketName: string) => Promise<BucketInfo | null>;
  getBucketManifests: (bucketName: string, forceRefresh?: boolean) => Promise<string[]>;
  getBucketManifestsPage: (
    bucketName: string,
    options?: { query?: string; offset?: number; limit?: number }
  ) => Promise<BucketManifestPage>;
  clearManifestCache: (bucketName?: string) => void;
  cleanup: () => void;
}

let cachedBuckets: BucketInfo[] | null = null;
let isFetching = false;
let globalError: string | null = null;
let shouldRefreshCache = false;
let inFlightFetch: Promise<void> | null = null;
let inFlightSummaryFetch: Promise<void> | null = null;
const inFlightBucketManifestCount = new Map<string, number>();
const inFlightBucketInfo = new Map<string, Promise<BucketInfo | null>>();
const listeners = new Set<() => void>();
let preloadPromise: Promise<void> | null = null;
let preloadPromiseGeneration = -1;
let bucketCacheGeneration = 0;
let bucketManifestCountRequestId = 0;
const BUCKET_MANIFEST_COUNT_BATCH_SIZE = 8;
const BUCKET_DETAIL_CONCURRENCY = 2;

const getCurrentBuckets = () => cachedBuckets || [];

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const normalizeBucketInfo = (bucket: BucketInfo): BucketInfo => ({
  ...bucket,
  manifest_count_loaded: bucket.manifest_count_loaded ?? bucket.details_loaded ?? true,
  details_loaded: bucket.details_loaded ?? true,
});

const replaceCachedBuckets = (buckets: BucketInfo[] | null) => {
  cachedBuckets = buckets?.map(normalizeBucketInfo) ?? null;
  bucketCacheGeneration += 1;
};

const isCurrentBucketCacheGeneration = (generation: number) => generation === bucketCacheGeneration;

// Add a function to update the cache from outside the hook
export function updateBucketsCache(buckets: BucketInfo[] | null) {
  replaceCachedBuckets(buckets);

  // Notify all listeners of the cache update
  notifyListeners();
}

// Export cache functions for external use
export { clearManifestCache, getManifestCache, setManifestCache };

export function useBuckets(): UseBucketsReturn {
  // Initialize with cached data if available to avoid unnecessary loading state on page switches
  const [buckets, setBuckets] = createSignal<BucketInfo[]>(getCurrentBuckets());
  const [loading, setLoading] = createSignal(isFetching || !cachedBuckets);
  const [error, setError] = createSignal<string | null>(globalError);

  const syncFromGlobalState = () => {
    setBuckets(getCurrentBuckets());
    setLoading(isFetching);
    setError(globalError);
  };

  const runFetch = async (quiet: boolean) => {
    isFetching = true;
    globalError = null;
    if (!quiet) {
      setLoading(true);
      setError(null);
      notifyListeners();
    }

    try {
      const result = await invoke<BucketInfo[]>('get_buckets');
      replaceCachedBuckets(result);
      globalError = null;
      shouldRefreshCache = false;
    } catch (err) {
      console.error('Failed to fetch buckets:', err);
      globalError = err as string;
    } finally {
      isFetching = false;
      inFlightFetch = null;
      notifyListeners();
    }
  };

  const runSummaryFetch = async (quiet: boolean) => {
    isFetching = true;
    globalError = null;
    if (!quiet) {
      setLoading(true);
      setError(null);
      notifyListeners();
    }

    try {
      const result = await invoke<BucketInfo[]>('get_bucket_summaries');
      replaceCachedBuckets(result);
      globalError = null;
      shouldRefreshCache = false;
      void preloadBucketDetails();
    } catch (err) {
      console.error('Failed to fetch bucket summaries:', err);
      globalError = err as string;
    } finally {
      isFetching = false;
      inFlightSummaryFetch = null;
      notifyListeners();
    }
  };

  const fetchBuckets = async (forceRefresh = false, quiet = false) => {
    if (inFlightFetch) {
      await inFlightFetch;
      if (!forceRefresh) {
        return;
      }
    }

    if (inFlightSummaryFetch) {
      await inFlightSummaryFetch;
    }

    // If we have cached data and it's not a force refresh, use it immediately
    // This ensures the UI shows cached data even if we're still fetching in the background
    if (cachedBuckets && !forceRefresh && !shouldRefreshCache) {
      setBuckets(cachedBuckets);
      if (!quiet) {
        setLoading(false);
      }
      void preloadBucketDetails();
      return;
    }

    inFlightFetch = runFetch(quiet);
    await inFlightFetch;
  };

  const fetchBucketSummaries = async (forceRefresh = false, quiet = false) => {
    if (inFlightFetch) {
      await inFlightFetch;
      if (!forceRefresh) {
        return;
      }
    }

    if (inFlightSummaryFetch) {
      await inFlightSummaryFetch;
      if (!forceRefresh) {
        return;
      }
    }

    if (cachedBuckets && !forceRefresh && !shouldRefreshCache) {
      setBuckets(cachedBuckets);
      if (!quiet) {
        setLoading(false);
      }
      void preloadBucketDetails();
      return;
    }

    inFlightSummaryFetch = runSummaryFetch(quiet);
    await inFlightSummaryFetch;
  };

  const markForRefresh = () => {
    shouldRefreshCache = true;
    bucketCacheGeneration += 1;
    preloadPromise = null;
    preloadPromiseGeneration = -1;
    inFlightBucketManifestCount.clear();
    inFlightBucketInfo.clear();
    // Clear all manifest caches when buckets need refresh
    clearManifestCache();
  };

  const unsubscribe = subscribe(syncFromGlobalState);

  let isCleanedUp = false;

  const cleanup = () => {
    if (isCleanedUp) {
      return;
    }
    isCleanedUp = true;
    unsubscribe();
  };

  if (getOwner()) {
    onCleanup(cleanup);
  }

  const getBucketInfo = async (bucketName: string): Promise<BucketInfo | null> => {
    try {
      return await invoke<BucketInfo>('get_bucket_info', { bucketName });
    } catch (err) {
      console.error(`Failed to get info for bucket ${bucketName}:`, err);
      return null;
    }
  };

  const hydrateBucketManifestCounts = async (bucketNames: string[]): Promise<BucketInfo[]> => {
    const requestGeneration = bucketCacheGeneration;
    const namesToCount = bucketNames.filter((bucketName) => {
      const existingBucket = cachedBuckets?.find((bucket) => bucket.name === bucketName);
      return (
        existingBucket &&
        !existingBucket.manifest_count_loaded &&
        !inFlightBucketManifestCount.has(bucketName)
      );
    });

    if (namesToCount.length === 0) {
      return [];
    }

    const requestId = ++bucketManifestCountRequestId;
    namesToCount.forEach((bucketName) => inFlightBucketManifestCount.set(bucketName, requestId));

    try {
      const counts = await invoke<BucketManifestCount[]>('get_bucket_manifest_counts', {
        bucketNames: namesToCount,
      });
      const countByBucket = new Map(
        counts.map((count) => [count.bucket_name, count.manifest_count])
      );
      const updatedBuckets: BucketInfo[] = [];

      if (!isCurrentBucketCacheGeneration(requestGeneration)) {
        return updatedBuckets;
      }

      cachedBuckets = (cachedBuckets || []).map((bucket) => {
        const manifestCount = countByBucket.get(bucket.name);
        if (manifestCount === undefined) {
          return bucket;
        }

        const nextBucketInfo = normalizeBucketInfo({
          ...bucket,
          manifest_count: manifestCount,
          manifest_count_loaded: true,
        });
        updatedBuckets.push(nextBucketInfo);
        return nextBucketInfo;
      });
      notifyListeners();
      return updatedBuckets;
    } catch (err) {
      console.error('Failed to count bucket manifests:', err);
      return [];
    } finally {
      namesToCount.forEach((bucketName) => {
        if (inFlightBucketManifestCount.get(bucketName) === requestId) {
          inFlightBucketManifestCount.delete(bucketName);
        }
      });
    }
  };

  const hydrateBucketInfo = async (bucketName: string): Promise<BucketInfo | null> => {
    const existingBucket = cachedBuckets?.find((bucket) => bucket.name === bucketName);
    if (existingBucket?.details_loaded) {
      return existingBucket;
    }

    const requestGeneration = bucketCacheGeneration;
    const inFlight = inFlightBucketInfo.get(bucketName);
    if (inFlight) {
      return inFlight;
    }

    const request = getBucketInfo(bucketName)
      .then((bucketInfo) => {
        if (!bucketInfo) {
          return null;
        }

        const nextBucketInfo = normalizeBucketInfo(bucketInfo);
        const currentBuckets = cachedBuckets || [];
        if (!isCurrentBucketCacheGeneration(requestGeneration)) {
          return null;
        }

        const bucketExists = currentBuckets.some((bucket) => bucket.name === bucketName);
        if (!bucketExists) {
          return null;
        }

        cachedBuckets = currentBuckets.map((bucket) =>
          bucket.name === bucketName ? nextBucketInfo : bucket
        );
        notifyListeners();
        return nextBucketInfo;
      })
      .finally(() => {
        if (inFlightBucketInfo.get(bucketName) === request) {
          inFlightBucketInfo.delete(bucketName);
        }
      });

    inFlightBucketInfo.set(bucketName, request);
    return request;
  };

  const preloadBucketDetails = async (): Promise<void> => {
    const requestedGeneration = bucketCacheGeneration;

    if (preloadPromise) {
      const activePreloadGeneration = preloadPromiseGeneration;
      await preloadPromise;
      if (
        activePreloadGeneration === requestedGeneration &&
        requestedGeneration === bucketCacheGeneration
      ) {
        return;
      }
    }

    const isPreloadGenerationCurrent = () => requestedGeneration === bucketCacheGeneration;

    const nextPreloadPromise = (async () => {
      const bucketsToCount = getCurrentBuckets()
        .filter((bucket) => !bucket.manifest_count_loaded)
        .map((bucket) => bucket.name);

      for (
        let index = 0;
        index < bucketsToCount.length;
        index += BUCKET_MANIFEST_COUNT_BATCH_SIZE
      ) {
        if (!isPreloadGenerationCurrent()) {
          return;
        }

        await hydrateBucketManifestCounts(
          bucketsToCount.slice(index, index + BUCKET_MANIFEST_COUNT_BATCH_SIZE)
        );
      }

      if (!isPreloadGenerationCurrent()) {
        return;
      }

      const bucketsToHydrate = getCurrentBuckets()
        .filter((bucket) => !bucket.details_loaded)
        .map((bucket) => bucket.name);

      for (let index = 0; index < bucketsToHydrate.length; index += BUCKET_DETAIL_CONCURRENCY) {
        if (!isPreloadGenerationCurrent()) {
          return;
        }

        await Promise.allSettled(
          bucketsToHydrate
            .slice(index, index + BUCKET_DETAIL_CONCURRENCY)
            .map((bucketName) => hydrateBucketInfo(bucketName))
        );
      }
    })().finally(() => {
      if (preloadPromise === nextPreloadPromise) {
        preloadPromise = null;
        preloadPromiseGeneration = -1;
      }
    });

    preloadPromise = nextPreloadPromise;
    preloadPromiseGeneration = bucketCacheGeneration;
    await preloadPromise;
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

  const getBucketManifestsPage = async (
    bucketName: string,
    options: { query?: string; offset?: number; limit?: number } = {}
  ): Promise<BucketManifestPage> => {
    try {
      return await invoke<BucketManifestPage>('get_bucket_manifests_page', {
        bucketName,
        query: options.query?.trim() || null,
        offset: options.offset ?? 0,
        limit: options.limit ?? 80,
      });
    } catch (err) {
      console.error(`Failed to get manifest page for bucket ${bucketName}:`, err);
      return {
        manifests: [],
        total: 0,
        offset: options.offset ?? 0,
        limit: options.limit ?? 80,
        has_more: false,
      };
    }
  };

  return {
    buckets,
    loading,
    error,
    fetchBuckets,
    fetchBucketSummaries,
    preloadBucketDetails,
    markForRefresh,
    getBucketInfo,
    hydrateBucketManifestCounts,
    hydrateBucketInfo,
    getBucketManifests,
    getBucketManifestsPage,
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
