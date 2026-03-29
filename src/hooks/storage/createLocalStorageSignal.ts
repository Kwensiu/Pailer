import { createSignal, createEffect, Signal, createRoot } from 'solid-js';

const localSignalCache = new Map<string, { signal: Signal<any>; dispose: () => void }>();

// Cleanup function to prevent memory leaks
export function clearLocalStorageSignalCache() {
  // Dispose all signals before clearing the map
  for (const [key, { dispose }] of localSignalCache) {
    try {
      dispose();
    } catch (error) {
      console.warn(`Failed to dispose localStorage signal for key "${key}":`, error);
    }
  }
  localSignalCache.clear();
}

// Optional: Remove specific signal from cache
export function removeLocalStorageSignal(key: string) {
  const entry = localSignalCache.get(key);
  if (entry) {
    entry.dispose();
    localSignalCache.delete(key);
  }
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readInitialValue<T>(key: string, initialValue: T): T {
  if (!canUseLocalStorage()) {
    return initialValue;
  }

  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return initialValue;
    }

    try {
      return JSON.parse(item) as T;
    } catch {
      return initialValue;
    }
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return initialValue;
  }
}

export function createLocalStorageSignal<T>(key: string, initialValue: T): Signal<T> {
  if (localSignalCache.has(key)) {
    return localSignalCache.get(key)!.signal;
  }

  return createRoot((dispose) => {
    const [value, setValue] = createSignal<T>(readInitialValue(key, initialValue));

    // Synchronously save to localStorage
    createEffect(() => {
      if (!canUseLocalStorage()) {
        return;
      }

      try {
        const currentValue = value();
        const hasKey = localStorage.getItem(key) !== null;

        if (currentValue === undefined) {
          if (hasKey) {
            localStorage.removeItem(key);
          }
        } else {
          localStorage.setItem(key, JSON.stringify(currentValue));
        }
      } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
      }
    });

    const signal: Signal<T> = [value, setValue];
    localSignalCache.set(key, { signal, dispose });

    return signal;
  });
}
