import { createSignal, createEffect, Signal, createRoot } from 'solid-js';
import { getSettingsStore } from '../stores/settings';

// Note: We now share the store instance with settings.ts
// All frontend data is stored in settings.json with namespaced keys
// Signals use the 'signals.' prefix for their keys

export function createTauriSignal<T>(key: string, initialValue: T): Signal<T> {
  // Namespace the key to avoid conflicts with settings
  const namespacedKey = `signals.${key}`;

  return createRoot(() => {
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
            isLoaded = true;
            setValue(() => storedValue as T);
            console.log(`createTauriSignal: Set loaded value for "${namespacedKey}"`);
          }
        } else {
          // Try legacy key (without 'signals.' prefix) for migration
          const legacyValue = await store.get(key);
          if (legacyValue !== undefined && legacyValue !== null) {
            console.log(`createTauriSignal: Migrating legacy key "${key}" to "${namespacedKey}"`);
            await store.set(namespacedKey, legacyValue);
            isLoaded = true;
            setValue(() => legacyValue as T);
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
      if (!isLoading && (isLoaded || currentValue !== initialValue)) {
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
          'initialValue:',
          initialValue
        );
      }
    });

    // Return the original signal and setter
    // The createEffect will handle persistence automatically
    return [value, setValue];
  });
}
