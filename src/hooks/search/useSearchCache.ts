import { getManifestCache } from '../buckets/useBuckets';
import { ScoopPackage } from '../../types/scoop';

// Global search cache manager
class SearchCacheManager {
  private cacheVersion = 0;
  private listeners: (() => void)[] = [];

  // Subscribe to cache invalidation events
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Invalidate all search caches
  invalidateCache(): void {
    this.cacheVersion++;

    // Notify all listeners
    this.listeners.forEach((listener) => listener());
  }

  // Get current cache version
  getCacheVersion(): number {
    return this.cacheVersion;
  }
}

// Create global instance
export const searchCacheManager = new SearchCacheManager();

// localStorage size management utilities
export const localStorageUtils = {
  // Get approximate localStorage size in bytes
  getStorageSize(prefix?: string): number {
    let total = 0;
    const targetPrefix = prefix || SEARCH_CACHE_PREFIX;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key) && key.startsWith(targetPrefix)) {
        total += key.length + localStorage.getItem(key)!.length;
      }
    }
    return total * 2; // Rough estimate (UTF-16 encoding)
  },

  // Clean up old cache entries based on age
  cleanupOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000, prefix?: string): void {
    // 7 days default
    const now = Date.now();
    const keysToRemove: string[] = [];
    const targetPrefix = prefix || SEARCH_CACHE_PREFIX;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith(targetPrefix)) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed: SearchCache = JSON.parse(cached);
            if (now - parsed.timestamp > maxAge) {
              keysToRemove.push(key);
            }
          }
        } catch (e) {
          // Invalid cache entry, remove it
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  },

  // Limit total cache size by removing oldest entries
  limitCacheSize(maxSizeBytes: number = 5 * 1024 * 1024, prefix?: string): void {
    // 5MB default
    const currentSize = this.getStorageSize(prefix);
    if (currentSize <= maxSizeBytes) return;

    const targetPrefix = prefix || SEARCH_CACHE_PREFIX;

    // Get all cache entries with timestamps
    const cacheEntries: Array<{ key: string; timestamp: number; size: number }> = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith(targetPrefix)) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed: SearchCache = JSON.parse(cached);
            cacheEntries.push({
              key,
              timestamp: parsed.timestamp,
              size: key.length + cached.length,
            });
          }
        } catch (e) {
          // Remove invalid entries
          localStorage.removeItem(key);
        }
      }
    }

    // Sort by timestamp (oldest first) and remove until under limit
    cacheEntries.sort((a, b) => a.timestamp - b.timestamp);

    let removedCount = 0;
    let currentSizeAfterRemoval = currentSize;

    for (const entry of cacheEntries) {
      if (currentSizeAfterRemoval <= maxSizeBytes) break;
      localStorage.removeItem(entry.key);
      currentSizeAfterRemoval -= entry.size * 2; // Rough estimate
      removedCount++;
    }
  },
};

interface SearchCache {
  packages: ScoopPackage[];
  timestamp: number;
  searchTerm: string;
}

interface UseSearchCacheReturn {
  getCachedSearch: (bucketName: string, searchTerm: string) => ScoopPackage[] | null;
  cacheSearch: (bucketName: string, searchTerm: string, packages: ScoopPackage[]) => void;
  clearCache: (bucketName?: string) => void;
}

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes for search cache
const SEARCH_CACHE_PREFIX = 'search_cache_';

// Helper function to create safe cache keys
const getSearchCacheKey = (bucketName: string, searchTerm: string): string => {
  const safeBucket = bucketName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const safeTerm = searchTerm.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  return `${SEARCH_CACHE_PREFIX}${safeBucket}__${safeTerm}`;
};

// Get search cache from localStorage
const getSearchCache = (bucketName: string, searchTerm: string): SearchCache | null => {
  try {
    const cacheKey = getSearchCacheKey(bucketName, searchTerm);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed: SearchCache = JSON.parse(cached);
      // Check if cache is still valid
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed;
      }
      // Remove expired cache
      localStorage.removeItem(cacheKey);
    }
  } catch (error) {
    console.error('Failed to read search cache:', error);
  }
  return null;
};

// Set search cache to localStorage
const setSearchCache = (bucketName: string, searchTerm: string, packages: ScoopPackage[]): void => {
  const cache: SearchCache = {
    packages,
    timestamp: Date.now(),
    searchTerm,
  };
  const cacheKey = getSearchCacheKey(bucketName, searchTerm);

  try {
    localStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to set search cache:', error);

    // Proactively handle quota exceeded with graceful degradation
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, cleaning up old cache entries');

      // Clean up expired cache entries first
      localStorageUtils.cleanupOldCache();

      // Retry writing after cleanup
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cache));
      } catch (retryError) {
        // If still failing, limit cache size and retry
        console.warn('Still failing after cleanup, limiting cache size');
        localStorageUtils.limitCacheSize(Math.floor(localStorageUtils.getStorageSize() * 0.8));

        try {
          localStorage.setItem(cacheKey, JSON.stringify(cache));
        } catch (finalError) {
          console.error('Failed to write cache even after cleanup and size limit:', finalError);
          // Final failure: disable cache instead of crashing
        }
      }
    }
  }
};

// Clear search cache
const clearSearchCache = (bucketName?: string): void => {
  try {
    if (bucketName) {
      // Clear cache for specific bucket
      const keys = Object.keys(localStorage);
      const safeBucketName = bucketName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      keys.forEach((key) => {
        // Match format: search_cache_{bucket}__{term}
        // Only clear search caches starting with specified bucket
        if (key.startsWith(`${SEARCH_CACHE_PREFIX}${safeBucketName}__`)) {
          localStorage.removeItem(key);
        }
      });
    } else {
      // Clear all search caches
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(SEARCH_CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Failed to clear search cache:', error);
  }
};

export function useSearchCache(): UseSearchCacheReturn {
  if (typeof window !== 'undefined') {
    try {
      localStorageUtils.cleanupOldCache();
      localStorageUtils.limitCacheSize();
    } catch (error) {
      console.warn('Failed to clean up localStorage cache:', error);
    }
  }

  const getCachedSearch = (bucketName: string, searchTerm: string): ScoopPackage[] | null => {
    const searchCache = getSearchCache(bucketName, searchTerm);
    if (searchCache) {
      return searchCache.packages;
    }

    const manifestCache = getManifestCache(bucketName);
    if (manifestCache && searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      return manifestCache.manifests
        .filter((manifest) => manifest.toLowerCase().includes(query))
        .map((manifest) => ({
          name: manifest,
          version: '',
          source: bucketName,
          updated: '',
          is_installed: false,
          info: '',
          match_source: 'name' as const,
          available_version: undefined,
          installation_type: 'standard',
          has_multiple_versions: false,
        }));
    }

    return null;
  };

  const cacheSearch = (bucketName: string, searchTerm: string, packages: ScoopPackage[]): void => {
    setSearchCache(bucketName, searchTerm, packages);
  };

  const clearCache = (bucketName?: string): void => {
    clearSearchCache(bucketName);
  };

  return { getCachedSearch, cacheSearch, clearCache };
}
