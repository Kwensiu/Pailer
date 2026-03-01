import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface SessionCache<T> {
  data: T;
  timestamp: number;
}

// Cache expiration time (5 minutes)
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

// Global cache instance map
const globalCaches = new Map<string, any>();

function createSessionCacheInstance<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = createSignal<T | null>(null);
  const [loading, setLoading] = createSignal(true);
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
    try {
      setLoading(true);
      setError(null);
      const results = await fetcher();
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
    if (initialized) return;

    const cached = getCachedData();

    if (cached && cached.data !== null) {
      // Use cached data
      setData(() => cached.data);
      setLoading(false);
      initialized = true;

      // Background silent cache update (optional)
      fetchData();
    } else {
      // No cache, perform detection
      await fetchData();
      initialized = true;
    }
  };

  // Clear cache
  const clearCache = () => {
    sessionStorage.removeItem(key);
    setData(null);
    initialized = false;
  };

  // Manual refresh detection
  const refresh = () => {
    fetchData();
  };

  return {
    data,
    loading,
    error,
    refresh,
    clearCache,
    initialize,
  };
}

export function createSessionCache<T>(key: string, fetcher: () => Promise<T>) {
  if (!globalCaches.has(key)) {
    globalCaches.set(key, createSessionCacheInstance(key, fetcher));
  }
  return globalCaches.get(key) as ReturnType<typeof createSessionCacheInstance<T>>;
}

// PowerShell specific convenience function
export function createPowerShellCache() {
  return createSessionCache('powershell_executables_cache', () =>
    invoke<string[]>('get_available_powershell_executables')
  );
}
