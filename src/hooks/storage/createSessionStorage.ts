import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface CacheData<T> {
  data: T;
  timestamp: number;
}

const CACHE_EXPIRY_MS = 5 * 60 * 1000;
const globalCaches = new Map<string, any>();
const invalidationListeners = new Map<string, Set<() => void>>();
const activeFetches = new Map<string, Promise<any>>();
const invalidationCallStack = new Map<string, number>();
const MAX_INVALIDATION_DEPTH = 3;

export function invalidateCache(key: string) {
  // Prevent infinite loops by tracking call depth
  const currentDepth = invalidationCallStack.get(key) || 0;
  if (currentDepth >= MAX_INVALIDATION_DEPTH) {
    console.warn(
      `Cache invalidation loop detected for key "${key}". Stopping at depth ${currentDepth}.`
    );
    return;
  }

  const listeners = invalidationListeners.get(key);
  if (listeners && listeners.size > 0) {
    invalidationCallStack.set(key, currentDepth + 1);

    // Execute all callbacks synchronously and reset depth immediately
    const callbacks = Array.from(listeners);
    callbacks.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error(`Error in cache invalidation callback for key "${key}":`, e);
      }
    });

    // Reset depth immediately after all callbacks complete
    const depth = invalidationCallStack.get(key) || 0;
    if (depth > 0) {
      invalidationCallStack.set(key, depth - 1);
    }
  }
}

export function createCache<T>(key: string, fetcher: () => Promise<T>) {
  if (globalCaches.has(key)) {
    return globalCaches.get(key);
  }

  const [data, setData] = createSignal<T | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const listeners = new Set<() => void>();
  invalidationListeners.set(key, listeners);

  let isInitialized = false;

  const safeSetSessionStorage = (storageKey: string, value: string): boolean => {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        sessionStorage.setItem(storageKey, value);
        return true;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          console.warn(
            `SessionStorage quota exceeded for key "${storageKey}", cleanup attempt ${retryCount + 1}`
          );

          // Get all cache keys except current one
          const keys = Object.keys(sessionStorage);
          const cacheKeys = keys.filter((k) => k !== storageKey && k.startsWith('cache_'));

          if (cacheKeys.length > 0) {
            // Remove multiple old entries to free more space
            const keysToRemove = cacheKeys.slice(0, Math.min(5, cacheKeys.length));
            keysToRemove.forEach((k) => sessionStorage.removeItem(k));
            retryCount++;
            continue;
          }
        }
        console.error(`Failed to set sessionStorage for key "${storageKey}":`, e);
        return false;
      }
    }
    console.error(`Failed to set sessionStorage after ${maxRetries} cleanup attempts`);
    return false;
  };

  const fetchData = async () => {
    // Prevent concurrent fetches
    const activePromise = activeFetches.get(key);
    if (activePromise) {
      return await activePromise;
    }

    if (loading()) {
      return data();
    }

    setLoading(true);
    setError(null);

    const fetchPromise = (async () => {
      try {
        const cached = sessionStorage.getItem(key);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as CacheData<T>;
            if (Date.now() - parsed.timestamp <= CACHE_EXPIRY_MS) {
              setData(() => parsed.data);
              return parsed.data;
            }
          } catch (parseError) {
            console.warn(`Failed to parse cache for key "${key}":`, parseError);
          }
          sessionStorage.removeItem(key);
        }

        const results = await fetcher();
        setData(() => results);

        const cacheData = JSON.stringify({
          data: results,
          timestamp: Date.now(),
        });

        safeSetSessionStorage(key, cacheData);
        return results;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error(`Failed to fetch data for key "${key}":`, err);
        throw err;
      } finally {
        setLoading(false);
        activeFetches.delete(key);
      }
    })();

    activeFetches.set(key, fetchPromise);
    return await fetchPromise;
  };

  const initialize = async () => {
    if (isInitialized) return;

    const cached = sessionStorage.getItem(key);
    if (!cached) {
      await fetchData();
    } else {
      try {
        const parsed = JSON.parse(cached) as CacheData<T>;
        if (Date.now() - parsed.timestamp > CACHE_EXPIRY_MS) {
          sessionStorage.removeItem(key);
          await fetchData();
        } else {
          setData(() => parsed.data);
        }
      } catch (parseError) {
        console.warn(`Failed to parse cache during initialization for key "${key}":`, parseError);
        sessionStorage.removeItem(key);
        await fetchData();
      }
    }
    isInitialized = true;
  };

  initialize();

  const refresh = () => fetchData();

  const clear = () => {
    sessionStorage.removeItem(key);
    setData(null);
    setError(null);
  };

  const updateData = (newData: T) => {
    const cacheData = JSON.stringify({
      data: newData,
      timestamp: Date.now(),
    });
    safeSetSessionStorage(key, cacheData);
    setData(() => newData);
  };

  const onInvalidate = (callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  };

  const cache = {
    data,
    loading,
    error,
    refresh,
    clear,
    updateData,
    onInvalidate,
    invalidate: () => invalidateCache(key),
  };

  globalCaches.set(key, cache);
  return cache;
}

export function createSessionCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  autoInvalidate: boolean = false
) {
  const cache = createCache(key, fetcher);

  if (autoInvalidate) {
    cache.onInvalidate(() => {
      // Prevent infinite loops: only refresh when data actually needs to be updated
      setTimeout(() => cache.refresh(), 100);
    });
  }

  return cache;
}

// PowerShell specific convenience function
export function createPowerShellCache() {
  return createSessionCache('powershell_executables_cache', () =>
    invoke<string[]>('get_available_powershell_executables')
  );
}
