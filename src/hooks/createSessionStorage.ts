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
  if (listeners) {
    invalidationCallStack.set(key, currentDepth + 1);
    try {
      listeners.forEach((cb) => {
        try {
          // Use setTimeout to defer execution and prevent synchronous loops
          setTimeout(() => cb(), 0);
        } catch (e) {
          console.error(e);
        }
      });
    } finally {
      // Reset call depth after a short delay to allow legitimate re-invalidations
      setTimeout(() => {
        invalidationCallStack.set(key, 0);
      }, 100);
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

  const fetchData = async () => {
    // 防止并发获取
    if (activeFetches.has(key)) {
      return await activeFetches.get(key);
    }

    if (loading()) return;

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
        sessionStorage.setItem(
          key,
          JSON.stringify({
            data: results,
            timestamp: Date.now(),
          })
        );
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
    sessionStorage.setItem(
      key,
      JSON.stringify({
        data: newData,
        timestamp: Date.now(),
      })
    );
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
      // 防止无限循环：只在数据实际需要更新时刷新
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
