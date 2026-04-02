import { createSignal, createEffect, Signal, createRoot } from 'solid-js';
import { getSettingsStore } from '../../stores/settings';

// Cache for signals to ensure same key returns same signal instance
const signalCache = new Map<string, { signal: Signal<any>; dispose: () => void }>();

// Cleanup function to prevent memory leaks
export function clearTauriSignalCache() {
  // Dispose all signals before clearing the map
  for (const [key, { dispose }] of signalCache) {
    try {
      dispose();
    } catch (error) {
      console.warn(`Failed to dispose Tauri signal for key "${key}":`, error);
    }
  }
  signalCache.clear();
}

// Optional: Remove specific signal from cache
export function removeTauriSignal(key: string) {
  const entry = signalCache.get(key);
  if (entry) {
    entry.dispose();
    signalCache.delete(key);
  }
}

const isDev = import.meta.env.DEV;

function logDebug(...args: unknown[]) {
  if (isDev) {
    console.log(...args);
  }
}

function getLocalStorageInitialValue<T>(key: string, initialValue: T): T {
  try {
    const localStorageValue = localStorage.getItem(key);
    if (localStorageValue === null) {
      return initialValue;
    }

    try {
      return JSON.parse(localStorageValue) as T;
    } catch {
      return localStorageValue as T;
    }
  } catch {
    return initialValue;
  }
}

export function createTauriSignal<T>(key: string, initialValue: T): Signal<T> {
  // Check cache first
  if (signalCache.has(key)) {
    return signalCache.get(key)!.signal;
  }

  return createRoot((dispose) => {
    // Namespace the key to avoid conflicts with settings
    const namespacedKey = `signals.${key}`;
    const storePromise = getSettingsStore();

    // Try to get initial value synchronously from localStorage first (for migration)
    const syncInitialValue = getLocalStorageInitialValue(key, initialValue);

    const [value, setValue] = createSignal<T>(syncInitialValue);
    let isLoaded = false;
    let isLoading = true;
    let shouldSave = false;
    let isSaving = false; // Prevent circular save loop

    logDebug(
      `createTauriSignal: Creating signal for key "${namespacedKey}" with initial value:`,
      syncInitialValue
    );

    // Immediately attempt to load value from store, don't wait for onMount
    (async () => {
      try {
        const store = await storePromise;
        const hasKey = await store.has(namespacedKey);
        logDebug(`createTauriSignal: Has key "${namespacedKey}" in store:`, hasKey);

        if (hasKey) {
          const storedValue = await store.get(namespacedKey);
          logDebug(`createTauriSignal: Loaded value for "${namespacedKey}":`, storedValue);
          if (storedValue !== undefined && storedValue !== null) {
            // Only set if value hasn't been changed from initial (prevent overriding user changes)
            if (value() === syncInitialValue) {
              isLoaded = true;
              setValue(() => storedValue as T);
              logDebug(`createTauriSignal: Set loaded value for "${namespacedKey}"`);
            } else {
              isLoaded = true;
              logDebug(
                `createTauriSignal: User has changed value, not overriding with loaded value`
              );
            }
          }
        } else {
          // Try legacy key (without 'signals.' prefix) for migration
          const legacyValue = await store.get(key);
          if (legacyValue !== undefined && legacyValue !== null) {
            logDebug(`createTauriSignal: Migrating legacy key "${key}" to "${namespacedKey}"`);
            await store.set(namespacedKey, legacyValue);
            // Only set if value hasn't been changed from initial
            if (value() === syncInitialValue) {
              isLoaded = true;
              setValue(() => legacyValue as T);
            } else {
              isLoaded = true;
            }
          } else {
            logDebug(
              `createTauriSignal: No stored value for "${namespacedKey}", using initial value`
            );
          }
        }

        // Clean up localStorage after successful load (migration)
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Error loading ${namespacedKey} from store:`, error);

        // Fallback: keep localStorage value if store fails
        // Don't remove localStorage in this case
      } finally {
        isLoading = false;
        shouldSave = true; // Enable saving after load completes
        logDebug(
          `createTauriSignal: Loading completed for "${namespacedKey}", isLoaded:`,
          isLoaded
        );
      }
    })();

    // This effect runs whenever the signal's value changes,
    // updating value in Tauri store.
    createEffect(() => {
      if (!shouldSave || isSaving) return; // Don't save until loading completes, and avoid circular save

      const currentValue = value();
      // Only save after loading is complete, avoid saving initial default value
      if (!isLoading && (isLoaded || currentValue !== syncInitialValue)) {
        logDebug(`createTauriSignal: Saving value for "${namespacedKey}":`, currentValue);
        isSaving = true;
        (async () => {
          try {
            const store = await storePromise;
            await store.set(namespacedKey, currentValue);
            logDebug(`createTauriSignal: Successfully saved "${namespacedKey}"`);
          } catch (error) {
            console.error(`Error saving ${namespacedKey} to store:`, error);
          } finally {
            isSaving = false;
          }
        })();
      } else {
        logDebug(
          `createTauriSignal: Not saving "${namespacedKey}" - isLoading:`,
          isLoading,
          'isLoaded:',
          isLoaded,
          'currentValue:',
          currentValue,
          'syncInitialValue:',
          syncInitialValue
        );
      }
    });

    // Create the signal
    const signal: Signal<T> = [value, setValue];
    signalCache.set(key, { signal, dispose });

    return signal;
  });
}
