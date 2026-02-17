import { createSignal, createEffect, Signal, createRoot } from "solid-js";
import { Store } from "@tauri-apps/plugin-store";

let globalStore: Store | null = null;

async function getStore(): Promise<Store> {
  if (!globalStore) {
    globalStore = await Store.load('signals.dat');
    // Log the path for debugging
    console.log('Tauri store for signals loaded successfully');
  }
  return globalStore;
}

export function createTauriSignal<T>(
  key: string,
  initialValue: T,
): Signal<T> {
  return createRoot(() => {
    // Try to get initial value synchronously from localStorage first
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
    
    console.log(`createTauriSignal: Creating signal for key "${key}" with initial value:`, syncInitialValue);
    
    // Immediately attempt to load value from store, don't wait for onMount
    (async () => {
      try {
        const store = await getStore();
        const hasKey = await store.has(key);
        console.log(`createTauriSignal: Has key "${key}" in store:`, hasKey);
        
        if (hasKey) {
          const storedValue = await store.get(key);
          console.log(`createTauriSignal: Loaded value for "${key}":`, storedValue);
          if (storedValue !== undefined && storedValue !== null) {
            isLoaded = true;
            setValue(() => storedValue as T);
            console.log(`createTauriSignal: Set loaded value for "${key}"`);
          }
        } else {
          console.log(`createTauriSignal: No stored value for "${key}", using initial value`);
        }
      } catch (error) {
        console.error(`Error loading ${key} from store:`, error);
        
        // Fallback to localStorage for migration
        try {
          const localStorageValue = localStorage.getItem(key);
          if (localStorageValue !== null) {
            console.log(`createTauriSignal: Found value in localStorage for "${key}":`, localStorageValue);
            // Try to parse as JSON, if it fails use as string
            try {
              const parsed = JSON.parse(localStorageValue);
              isLoaded = true;
              setValue(() => parsed as T);
              console.log(`createTauriSignal: Migrated localStorage value for "${key}"`);
              // Migrate to Tauri store
              const store = await getStore();
              await store.set(key, parsed);
            } catch {
              // Use as string if not valid JSON
              isLoaded = true;
              setValue(() => localStorageValue as T);
              console.log(`createTauriSignal: Migrated localStorage string value for "${key}"`);
              const store = await getStore();
              await store.set(key, localStorageValue);
            }
            localStorage.removeItem(key);
          }
        } catch (localStorageError) {
          console.error(`Error reading ${key} from localStorage:`, localStorageError);
        }
      } finally {
        isLoading = false;
        console.log(`createTauriSignal: Loading completed for "${key}", isLoaded:`, isLoaded);
      }
    })();

    // This effect runs whenever the signal's value changes,
    // updating value in Tauri store.
    createEffect(() => {
      const currentValue = value();
      // Only save after loading is complete, avoid saving initial default value
      if (!isLoading && (isLoaded || currentValue !== initialValue)) {
        console.log(`createTauriSignal: Saving value for "${key}":`, currentValue);
        (async () => {
          try {
            const store = await getStore();
            await store.set(key, currentValue);
            console.log(`createTauriSignal: Successfully saved "${key}"`);
            // Also save to localStorage for immediate sync access
            try {
              if (typeof currentValue === 'string') {
                localStorage.setItem(key, currentValue);
              } else {
                localStorage.setItem(key, JSON.stringify(currentValue));
              }
            } catch (localStorageError) {
              console.error(`Error saving ${key} to localStorage sync:`, localStorageError);
            }
          } catch (error) {
            console.error(`Error saving ${key} to store:`, error);
            // Fallback to localStorage if Tauri store fails
            try {
              if (typeof currentValue === 'string') {
                localStorage.setItem(key, currentValue);
              } else {
                localStorage.setItem(key, JSON.stringify(currentValue));
              }
              console.log(`createTauriSignal: Saved "${key}" to localStorage fallback`);
            } catch (localStorageError) {
              console.error(`Error saving ${key} to localStorage:`, localStorageError);
            }
          }
        })();
      } else {
        console.log(`createTauriSignal: Not saving "${key}" - isLoading:`, isLoading, "isLoaded:", isLoaded, "currentValue:", currentValue, "initialValue:", initialValue);
      }
    });

    // Return the original signal and setter
    // The createEffect will handle persistence automatically
    return [value, setValue];
  });
}