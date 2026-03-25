import { createSignal, createEffect, Signal, createRoot } from 'solid-js';

export function createLocalStorageSignal<T>(key: string, initialValue: T): Signal<T> {
  return createRoot(() => {
    // Synchronously read localStorage
    let storedValue: T | undefined;
    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        storedValue = JSON.parse(item) as T;
      }
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
    }

    const [value, setValue] = createSignal<T>(storedValue ?? initialValue);

    // Synchronously save to localStorage
    createEffect(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value()));
      } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
      }
    });

    return [value, setValue];
  });
}
