import { createSignal, createEffect, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface CacheData<T> {
  data: T;
  timestamp: number;
}

interface RefreshOptions {
  bypassCache?: boolean;
}

const DEFAULT_FORCE_REFRESH_OPTIONS: RefreshOptions = {
  bypassCache: true,
};

// Safe sessionStorage operations
function safeSessionStorageRemove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove sessionStorage key "${key}":`, error);
  }
}

const CACHE_EXPIRY_MS = 5 * 60 * 1000;
const CACHE_KEY_PREFIX = 'cache:';
const globalCaches = new Map<string, any>();
const invalidationListeners = new Map<string, Set<() => void>>();
const activeFetches = new Map<string, Promise<any>>();
const invalidationCallStack = new Map<string, number>();
const MAX_INVALIDATION_DEPTH = 3;

function getStorageKey(key: string): string {
  return `${CACHE_KEY_PREFIX}${key}`;
}

function getCacheStorageKeys(excludeKey?: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key || !key.startsWith(CACHE_KEY_PREFIX)) {
      continue;
    }
    if (excludeKey && key === excludeKey) {
      continue;
    }
    keys.push(key);
  }
  return keys;
}

function readValidCache<T>(storageKey: string): { hit: true; data: T } | { hit: false } {
  const cached = sessionStorage.getItem(storageKey);
  if (!cached) {
    return { hit: false };
  }

  try {
    const parsed = JSON.parse(cached) as CacheData<T>;
    if (Date.now() - parsed.timestamp <= CACHE_EXPIRY_MS) {
      return { hit: true, data: parsed.data };
    }
  } catch (parseError) {
    console.warn(`Failed to parse cache for key "${storageKey}":`, parseError);
  }

  safeSessionStorageRemove(storageKey);
  return { hit: false };
}

function migrateLegacyCacheKey(storageKey: string, legacyKey: string): void {
  if (storageKey === legacyKey || sessionStorage.getItem(storageKey) !== null) {
    return;
  }

  const legacyValue = sessionStorage.getItem(legacyKey);
  if (legacyValue === null) {
    return;
  }

  try {
    sessionStorage.setItem(storageKey, legacyValue);
    safeSessionStorageRemove(legacyKey);
  } catch (error) {
    console.warn(
      `Failed to migrate legacy cache key from "${legacyKey}" to "${storageKey}":`,
      error
    );
  }
}

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

  const storageKey = getStorageKey(key);

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
          const cacheKeys = getCacheStorageKeys(storageKey);

          if (cacheKeys.length > 0) {
            // Remove multiple old entries to free more space
            const keysToRemove = cacheKeys.slice(0, Math.min(5, cacheKeys.length));
            keysToRemove.forEach((k) => safeSessionStorageRemove(k));
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

  const fetchData = async (options: RefreshOptions = {}) => {
    const { bypassCache = false } = options;

    // Prevent concurrent fetches
    const activePromise = activeFetches.get(key);
    if (activePromise) {
      return await activePromise;
    }

    // Only set loading if we're actually going to fetch
    if (!bypassCache) {
      const cached = readValidCache<T>(storageKey);
      if (cached.hit) {
        activeFetches.delete(key);
        setData(() => cached.data);
        setLoading(false);
        return cached.data;
      }
    }

    setLoading(true);
    setError(null);

    const fetchPromise = (async () => {
      try {
        migrateLegacyCacheKey(storageKey, key);

        const results = await fetcher();

        setData(() => results);
        setLoading(false);

        const cacheData = JSON.stringify({
          data: results,
          timestamp: Date.now(),
        });
        safeSetSessionStorage(storageKey, cacheData);
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

  let initPromise: Promise<void> | null = null;

  const initialize = async () => {
    if (isInitialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        migrateLegacyCacheKey(storageKey, key);
        const cached = readValidCache<T>(storageKey);
        if (cached.hit) {
          setData(() => cached.data);
        } else {
          await fetchData();
        }
        isInitialized = true;
      } catch (err) {
        console.error(`Failed to initialize cache for key "${key}":`, err);
        // Don't set isInitialized on failure, allowing retry
        throw err;
      } finally {
        initPromise = null;
      }
    })();

    return initPromise;
  };

  void initialize().catch((err) => {
    console.error(`Failed to initialize cache for key "${key}":`, err);
  });

  const refresh = (options?: RefreshOptions) => fetchData(options);

  const forceRefresh = (options: RefreshOptions = {}) =>
    fetchData({ ...DEFAULT_FORCE_REFRESH_OPTIONS, ...options, bypassCache: true });

  const clear = () => {
    safeSessionStorageRemove(storageKey);
    safeSessionStorageRemove(key);
    setData(null);
    setError(null);
  };

  const updateData = (newData: T) => {
    const cacheData = JSON.stringify({
      data: newData,
      timestamp: Date.now(),
    });
    safeSetSessionStorage(storageKey, cacheData);
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
    forceRefresh,
    clear,
    updateData,
    onInvalidate,
    invalidate: () => invalidateCache(key),
    dispose: () => {
      listeners.clear();
      invalidationListeners.delete(key);
      activeFetches.delete(key);
      invalidationCallStack.delete(key);
      globalCaches.delete(key);
    },
  };

  globalCaches.set(key, cache);
  return cache;
}

export function createSessionStorage<T>(
  key: string,
  fetcher: () => Promise<T>,
  autoInvalidate: boolean = false
) {
  const cache = createCache(key, fetcher);

  if (autoInvalidate) {
    createEffect(() => {
      let invalidateTimeout: ReturnType<typeof setTimeout> | null = null;

      const setupTimeout = () => {
        invalidateTimeout = setTimeout(() => {
          invalidateTimeout = null;
          cache.refresh().catch((err: unknown) => {
            console.error(`Failed to refresh cache "${key}" after invalidation:`, err);
          });
        }, 100);
      };

      cache.onInvalidate(setupTimeout);

      // Cleanup function to prevent memory leaks
      onCleanup(() => {
        if (invalidateTimeout) clearTimeout(invalidateTimeout);
      });
    });
  }

  return cache;
}

// PowerShell specific convenience function
export function createPowerShellCache() {
  return createSessionStorage('powershell_executables_cache', () =>
    invoke<string[]>('get_available_powershell_executables')
  );
}
