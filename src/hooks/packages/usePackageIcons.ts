import { createSignal, createEffect, on, onCleanup, onMount, Accessor } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { localStorageUtils } from '../search/useSearchCache';
import settingsStore from '../../stores/settings';

interface UsePackageIconsOptions {
  packageNames: Accessor<string[]>;
  size?: number;
}

interface UsePackageIconsReturn {
  icons: Accessor<Record<string, string>>;
  isLoading: Accessor<boolean>;
  failedIcons: Accessor<Set<string>>;
  refetch: () => void;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const ICON_CACHE_PREFIX = 'pkg_icon_';

interface IconCacheEntry {
  dataUrl: string;
  timestamp: number;
}

const SESSION_CACHE: Map<string, IconCacheEntry> = new Map();
const FAILED_CACHE: Map<string, number> = new Map();
const FAILED_CACHE_DURATION = 2 * 60 * 1000;

const normalizeScoopPathForCache = (path?: string): string =>
  (path || 'unconfigured').trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

const getIconCacheKey = (packageName: string, size: number, scoopPath: string): string =>
  `${normalizeScoopPathForCache(scoopPath)}_${packageName.toLowerCase()}_${size}`;

function getLocalStorageIconCache(
  packageName: string,
  size: number,
  scoopPath: string
): IconCacheEntry | null {
  try {
    const key = `${ICON_CACHE_PREFIX}${getIconCacheKey(packageName, size, scoopPath)}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed: IconCacheEntry = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed;
      }
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function setLocalStorageIconCache(
  packageName: string,
  dataUrl: string,
  size: number,
  scoopPath: string
): void {
  try {
    const cacheKey = getIconCacheKey(packageName, size, scoopPath);
    const key = `${ICON_CACHE_PREFIX}${cacheKey}`;
    const entry: IconCacheEntry = { dataUrl, timestamp: Date.now() };
    SESSION_CACHE.set(cacheKey, entry);
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore quota errors
  }
}

function getCachedIcon(
  packageName: string,
  size: number,
  scoopPath: string
): IconCacheEntry | null {
  const cacheKey = getIconCacheKey(packageName, size, scoopPath);
  const sessionCached = SESSION_CACHE.get(cacheKey);
  if (sessionCached) {
    if (Date.now() - sessionCached.timestamp < CACHE_DURATION) {
      return sessionCached;
    }
    SESSION_CACHE.delete(cacheKey);
  }

  const localCached = getLocalStorageIconCache(packageName, size, scoopPath);
  if (localCached) {
    SESSION_CACHE.set(cacheKey, localCached);
  }

  return localCached;
}

function isRecentlyFailed(packageName: string, size: number, scoopPath: string): boolean {
  const cacheKey = getIconCacheKey(packageName, size, scoopPath);
  const failedAt = FAILED_CACHE.get(cacheKey);
  if (!failedAt) {
    return false;
  }

  if (Date.now() - failedAt > FAILED_CACHE_DURATION) {
    FAILED_CACHE.delete(cacheKey);
    return false;
  }

  return true;
}

function markIconFailed(packageName: string, size: number, scoopPath: string): void {
  FAILED_CACHE.set(getIconCacheKey(packageName, size, scoopPath), Date.now());
}

export function usePackageIcons(options: UsePackageIconsOptions): UsePackageIconsReturn {
  const [icons, setIcons] = createSignal<Record<string, string>>({});
  const [isLoading, setIsLoading] = createSignal(false);
  const [failedIcons, setFailedIcons] = createSignal<Set<string>>(new Set());
  const iconSize = () => options.size || 32;
  const scoopPath = () => settingsStore.settings.scoopPath || '';

  // Use Map to track pending packages, avoiding infinite Set growth
  const [pendingPackages, setPendingPackages] = createSignal<Map<string, number>>(new Map());
  const [requestTimeoutId, setRequestTimeoutId] = createSignal<number | null>(null);
  let previousScoopPath = scoopPath();

  function scheduleBatchFetch(newPackages: string[]): void {
    const now = Date.now();
    const currentSize = iconSize();
    const currentScoopPath = scoopPath();

    // Merge into pending request queue with timestamp for tracking
    setPendingPackages((prev) => {
      const next = new Map(prev);
      newPackages.forEach((name) => next.set(name.toLowerCase(), now));
      return next;
    });

    // If timeout exists, cancel and reset
    const existingTimeout = requestTimeoutId();
    if (existingTimeout !== null) {
      clearTimeout(existingTimeout);
    }

    const timeoutId = window.setTimeout(async () => {
      const packagesToFetch = [...pendingPackages()].map(([name]) => name);
      setPendingPackages(new Map());

      if (packagesToFetch.length === 0) {
        setRequestTimeoutId(null);
        return;
      }

      setIsLoading(true);

      try {
        const fetchedIcons = await invoke<Record<string, string>>('get_installed_package_icons', {
          packageNames: packagesToFetch,
          size: currentSize,
        });

        // Cache successfully fetched icons
        Object.entries(fetchedIcons).forEach(([name, dataUrl]) => {
          setLocalStorageIconCache(name, dataUrl, currentSize, currentScoopPath);
        });

        // Only add successfully fetched icons
        if (Object.keys(fetchedIcons).length > 0) {
          setIcons((prev) => ({ ...prev, ...fetchedIcons }));
        }

        // Mark failed packages to prevent retry
        const failed = packagesToFetch.filter((name) => !fetchedIcons[name]);
        if (failed.length > 0) {
          setFailedIcons((prev) => {
            const next = new Set(prev);
            failed.forEach((f) => next.add(f));
            return next;
          });
          failed.forEach((name) => markIconFailed(name, currentSize, currentScoopPath));
        }
      } catch (error) {
        console.debug('Failed to fetch package icons:', error);
      } finally {
        setIsLoading(false);
        setRequestTimeoutId(null);
      }
    }, 50);

    setRequestTimeoutId(timeoutId);
  }

  // Initialize from localStorage cache on mount
  onMount(() => {
    localStorageUtils.cleanupOldCache(CACHE_DURATION, ICON_CACHE_PREFIX);
    localStorageUtils.limitCacheSize(2 * 1024 * 1024, ICON_CACHE_PREFIX);

    const packageNames = options.packageNames();
    const currentSize = iconSize();
    const currentScoopPath = scoopPath();
    const cachedIcons: Record<string, string> = {};

    packageNames.forEach((name) => {
      const cached = getCachedIcon(name, currentSize, currentScoopPath);
      if (cached) {
        cachedIcons[name] = cached.dataUrl;
      }
    });

    if (Object.keys(cachedIcons).length > 0) {
      setIcons(cachedIcons);
    }
  });

  // Fetch missing icons - track packageNames changes
  createEffect(
    on(
      () => [options.packageNames(), scoopPath()] as const,
      ([packageNames]) => {
        const currentScoopPath = scoopPath();
        if (currentScoopPath !== previousScoopPath) {
          previousScoopPath = currentScoopPath;
          setIcons({});
          setFailedIcons(new Set<string>());
          setPendingPackages(new Map());
        }

        if (packageNames.length === 0) {
          return;
        }

        const currentSize = iconSize();
        const currentIcons = icons();
        const cachedIcons: Record<string, string> = {};

        packageNames.forEach((name) => {
          if (currentIcons[name]) {
            return;
          }

          const cached = getCachedIcon(name, currentSize, currentScoopPath);
          if (cached) {
            cachedIcons[name] = cached.dataUrl;
          }
        });

        const cachedIconNames = Object.keys(cachedIcons);
        if (cachedIconNames.length > 0) {
          setIcons((prev) => ({ ...prev, ...cachedIcons }));
        }

        // Find packages that need fetching (not in cache and not already failed)
        const availableIcons = { ...currentIcons, ...cachedIcons };
        const missingPackages = packageNames.filter(
          (name) => !availableIcons[name] && !isRecentlyFailed(name, currentSize, currentScoopPath)
        );

        if (missingPackages.length === 0) {
          return;
        }

        scheduleBatchFetch(missingPackages);
      }
    )
  );

  const refetch = () => {
    // Clear all local cache and refetch
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(ICON_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore errors
    }

    SESSION_CACHE.clear();
    FAILED_CACHE.clear();
    setIcons({});
    setFailedIcons(new Set<string>());
    setPendingPackages(new Map());

    // Trigger refetch
    const packageNames = options.packageNames();
    if (packageNames.length > 0) {
      scheduleBatchFetch(packageNames);
    }
  };

  onCleanup(() => {
    const timeoutId = requestTimeoutId();
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });

  return {
    icons,
    isLoading,
    failedIcons,
    refetch,
  };
}
