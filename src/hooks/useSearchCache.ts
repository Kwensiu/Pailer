import { getManifestCache } from './useBuckets';
import { ScoopPackage } from '../types/scoop';

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
    console.log('🔄 Search cache invalidated globally, version:', this.cacheVersion);

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
  getStorageSize(): number {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += key.length + localStorage.getItem(key)!.length;
      }
    }
    return total * 2; // Rough estimate (UTF-16 encoding)
  },

  // Clean up old cache entries based on age
  cleanupOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    // 7 days default
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith(SEARCH_CACHE_PREFIX)) {
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
    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${keysToRemove.length} old cache entries`);
    }
  },

  // Limit total cache size by removing oldest entries
  limitCacheSize(maxSizeBytes: number = 5 * 1024 * 1024): void {
    // 5MB default
    const currentSize = this.getStorageSize();
    if (currentSize <= maxSizeBytes) return;

    // Get all cache entries with timestamps
    const cacheEntries: Array<{ key: string; timestamp: number; size: number }> = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith(SEARCH_CACHE_PREFIX)) {
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

    if (removedCount > 0) {
      console.log(`🧹 Limited cache size, removed ${removedCount} entries`);
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
  try {
    const cache: SearchCache = {
      packages,
      timestamp: Date.now(),
      searchTerm,
    };
    const cacheKey = getSearchCacheKey(bucketName, searchTerm);
    localStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to set search cache:', error);
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
        // 匹配格式: search_cache_{bucket}__{term}
        // 只清理以指定bucket开头的搜索缓存
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

      // Listen for cache invalidation events
      searchCacheManager.subscribe(() => {
        console.log('Search cache invalidated by package operation');
      });
    } catch (error) {
      console.warn('Failed to clean up localStorage cache:', error);
    }
  }

  const getCachedSearch = (bucketName: string, searchTerm: string): ScoopPackage[] | null => {
    const searchCache = getSearchCache(bucketName, searchTerm);
    if (searchCache) {
      console.log(`Using cached search results for bucket: ${bucketName}, term: ${searchTerm}`);
      return searchCache.packages;
    }

    const manifestCache = getManifestCache(bucketName);
    if (manifestCache && searchTerm.trim()) {
      console.log(`Using bucket manifests cache for fast filtering: ${bucketName}`);
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
