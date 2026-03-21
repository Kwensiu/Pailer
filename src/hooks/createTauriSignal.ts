import { createSignal, createEffect, Signal, createRoot } from 'solid-js';
import { getSettingsStore } from '../stores/settings';

// Cache for signals to ensure same key returns same signal instance
const signalCache = new Map<string, Signal<any>>();

export function createTauriSignal<T>(key: string, initialValue: T): Signal<T> {
  // Check cache first
  if (signalCache.has(key)) {
    return signalCache.get(key) as Signal<T>;
  }

  return createRoot(() => {
    // Namespace the key to avoid conflicts with settings
    const namespacedKey = `signals.${key}`;

    // Try to get initial value synchronously from localStorage first (for migration)
    let syncInitialValue = initialValue;
    try {
      const localStorageValue = localStorage.getItem(key);
      if (localStorageValue !== null) {
        try {
          syncInitialValue = JSON.parse(localStorageValue) as T;
        } catch {
          syncInitialValue = localStorageValue as T;
        }
      }
    } catch {
      // Use initialValue if localStorage fails
    }

    const [value, setValue] = createSignal<T>(syncInitialValue);
    let isLoaded = false;
    let isLoading = true;

    console.log(
      `createTauriSignal: Creating signal for key "${namespacedKey}" with initial value:`,
      syncInitialValue
    );

    // Immediately attempt to load value from store, don't wait for onMount
    (async () => {
      try {
        const store = await getSettingsStore();
        const hasKey = await store.has(namespacedKey);
        console.log(`createTauriSignal: Has key "${namespacedKey}" in store:`, hasKey);

        if (hasKey) {
          const storedValue = await store.get(namespacedKey);
          console.log(`createTauriSignal: Loaded value for "${namespacedKey}":`, storedValue);
          if (storedValue !== undefined && storedValue !== null) {
            // Only set if value hasn't been changed from initial (prevent overriding user changes)
            if (value() === syncInitialValue) {
              isLoaded = true;
              setValue(() => storedValue as T);
              console.log(`createTauriSignal: Set loaded value for "${namespacedKey}"`);
            } else {
              isLoaded = true;
              console.log(
                `createTauriSignal: User has changed value, not overriding with loaded value`
              );
            }
          }
        } else {
          // Try legacy key (without 'signals.' prefix) for migration
          const legacyValue = await store.get(key);
          if (legacyValue !== undefined && legacyValue !== null) {
            console.log(`createTauriSignal: Migrating legacy key "${key}" to "${namespacedKey}"`);
            await store.set(namespacedKey, legacyValue);
            // Only set if value hasn't been changed from initial
            if (value() === syncInitialValue) {
              isLoaded = true;
              setValue(() => legacyValue as T);
            } else {
              isLoaded = true;
            }
          } else {
            console.log(
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
        console.log(
          `createTauriSignal: Loading completed for "${namespacedKey}", isLoaded:`,
          isLoaded
        );
      }
    })();

    // This effect runs whenever the signal's value changes,
    // updating value in Tauri store.
    createEffect(() => {
      const currentValue = value();
      // Only save after loading is complete, avoid saving initial default value
      if (!isLoading && (isLoaded || currentValue !== syncInitialValue)) {
        console.log(`createTauriSignal: Saving value for "${namespacedKey}":`, currentValue);
        (async () => {
          try {
            const store = await getSettingsStore();
            await store.set(namespacedKey, currentValue);
            console.log(`createTauriSignal: Successfully saved "${namespacedKey}"`);
          } catch (error) {
            console.error(`Error saving ${namespacedKey} to store:`, error);
          }
        })();
      } else {
        console.log(
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

    // Cache it
    signalCache.set(key, signal);

    // Return the signal
    return signal;
  });
}
