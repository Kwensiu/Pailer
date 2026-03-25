import { createSignal, onCleanup } from 'solid-js';

/**
 * Hook for managing per-item confirmation with individual timers
 * Use when multiple items can each have their own confirmation state
 * @param timeout - Time in ms before confirmation auto-cancels (default: 2000)
 */
export function useMultiConfirmAction(timeout = 2000) {
  const [confirmingItem, setConfirmingItem] = createSignal<string | null>(null);
  const timers = new Map<string, number>();

  const clearTimer = (key: string) => {
    const timer = timers.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.delete(key);
    }
  };

  const startConfirm = (key: string) => {
    clearTimer(key);
    setConfirmingItem(key);
    const timer = window.setTimeout(() => {
      clearTimer(key);
      setConfirmingItem((current) => (current === key ? null : current));
    }, timeout);
    timers.set(key, timer);
  };

  const cancelConfirm = (key?: string) => {
    if (key) {
      clearTimer(key);
      setConfirmingItem((current) => (current === key ? null : current));
    } else {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      setConfirmingItem(null);
    }
  };

  const isConfirming = (key: string) => confirmingItem() === key;

  onCleanup(() => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
  });

  return {
    confirmingItem,
    startConfirm,
    cancelConfirm,
    isConfirming,
  };
}
