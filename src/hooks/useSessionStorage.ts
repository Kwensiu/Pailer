import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface SessionCache<T> {
  data: T;
  timestamp: number;
}

// Cache expiration time (5 minutes)
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

// Global cache instance map with weak references to prevent memory leaks
const globalCaches = new Map<string, any>();

// Global initialization tracking to prevent multiple initializations
const globalInitialized = new Set<string>();

// Cache cleanup interval (cleanup every 30 minutes)
setInterval(
  () => {
    // Remove expired cache entries based on timestamp
    for (const [key, cache] of globalCaches.entries()) {
      try {
        const cached = cache.getCachedData?.();
        if (!cached) {
          globalCaches.delete(key);
          globalInitialized.delete(key);
        }
      } catch (error) {
        // Remove corrupted cache entries
        globalCaches.delete(key);
        globalInitialized.delete(key);
      }
    }
  },
  30 * 60 * 1000
);

function createSessionCacheInstance<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = createSignal<T | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let initialized = false;

  // Read data from cache
  const getCachedData = (): SessionCache<T> | null => {
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached) as SessionCache<T>;
        // Check if cache has expired
        if (Date.now() - parsed.timestamp > CACHE_EXPIRY_MS) {
          sessionStorage.removeItem(key);
          return null;
        }
        return parsed;
      }
    } catch (err) {
      console.error(`Failed to read cache for key "${key}":`, err);
    }
    return null;
  };

  // Save data to cache
  const setCachedData = (newData: T) => {
    try {
      const cache: SessionCache<T> = {
        data: newData,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(key, JSON.stringify(cache));
    } catch (err) {
      console.error(`Failed to save cache for key "${key}":`, err);
    }
  };

  // Fetch data
  const fetchData = async () => {
    console.log(`🌐 [useSessionStorage] fetchData called for key: ${key}`);
    try {
      setLoading(true);
      setError(null);
      const results = await fetcher();
      console.log(`📦 [useSessionStorage] fetchData success for ${key}:`, !!results);
      setData(() => results);
      setCachedData(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error(`Failed to fetch data for key "${key}":`, err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize: check cache first, fetch if not available
  const initialize = async () => {
    console.log(`🔧 [useSessionStorage] initialize called for key: ${key}`, {
      initialized,
      globalInitialized: Array.from(globalInitialized),
    });

    // Prevent multiple initializations globally
    if (initialized || globalInitialized.has(key)) {
      console.log(
        `⏭️ [useSessionStorage] Skipping initialization for ${key} - already initialized`
      );
      // Ensure loading is false if we're skipping initialization
      setLoading(false);
      return;
    }

    const cached = getCachedData();
    console.log(`💾 [useSessionStorage] Cache check for ${key}:`, {
      hasCache: !!cached,
      hasData: cached?.data !== null,
    });

    if (cached && cached.data !== null) {
      // Use cached data
      console.log(`✅ [useSessionStorage] Using cached data for ${key}`);
      setData(() => cached.data);
      setLoading(false);
      initialized = true;
      globalInitialized.add(key);

      // No background update for update cache to avoid unnecessary API calls
    } else {
      // No cache, perform detection
      console.log(`🌐 [useSessionStorage] No cache for ${key}, fetching fresh data`);
      await fetchData();
      initialized = true;
      globalInitialized.add(key);
    }
  };

  // Clear cache
  const clearCache = () => {
    sessionStorage.removeItem(key);
    setData(null);
    initialized = false;
    // Don't delete from globalInitialized, allow re-initialization
    // globalInitialized.delete(key);
  };

  // Manual refresh detection
  const refresh = () => {
    fetchData();
  };

  // Direct update cache data (for update check results)
  const updateData = (newData: T) => {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        data: newData,
        timestamp: Date.now(),
      })
    );
    setData(() => newData);
    initialized = true;
    globalInitialized.add(key);
  };

  return {
    data,
    loading,
    error,
    refresh,
    updateData,
    clearCache,
    initialize,
  };
}

export function createSessionCache<T>(key: string, fetcher: () => Promise<T>) {
  if (!globalCaches.has(key)) {
    const cache = createSessionCacheInstance(key, fetcher);
    globalCaches.set(key, cache);
    // Auto-initialize the cache
    cache.initialize();
  }
  return globalCaches.get(key) as ReturnType<typeof createSessionCacheInstance<T>>;
}

// PowerShell specific convenience function
export function createPowerShellCache() {
  return createSessionCache('powershell_executables_cache', () =>
    invoke<string[]>('get_available_powershell_executables')
  );
}
