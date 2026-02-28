import { createEffect, onCleanup } from 'solid-js';
import { createTauriSignal } from './createTauriSignal';

interface UseGlobalHotkeyOptions {
  isEnabled?: () => boolean;
  onKeyDown: (e: KeyboardEvent) => boolean | void;
  shouldHandle?: (e: KeyboardEvent) => boolean;
}

export function useGlobalHotkey(options: UseGlobalHotkeyOptions) {
  const [isGlobalHotkeyEnabled] = createTauriSignal<boolean>(
    'globalHotkeyEnabled',
    true
  );

  createEffect(() => {
    const enabled = options.isEnabled?.() ?? isGlobalHotkeyEnabled();
    if (!enabled) {
      return;
    }

    const handleGlobalKeydown = (e: KeyboardEvent) => {
      // Default check: only handle when not already focused on input
      const shouldHandle = options.shouldHandle ?? (() => 
        document.activeElement?.tagName !== 'INPUT' && 
        document.activeElement?.tagName !== 'TEXTAREA'
      );
      
      if (!shouldHandle(e)) {
        return;
      }

      const result = options.onKeyDown(e);
      // If handler returns true, prevent default
      if (result === true) {
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    onCleanup(() => {
      document.removeEventListener('keydown', handleGlobalKeydown);
    });
  });
}

// Specific hook for search functionality
interface UseGlobalSearchHotkeyOptions {
  isEnabled?: () => boolean;
  onSearchStart: (char: string) => void;
  onClearSearch: () => void;
  shouldClear?: () => boolean;
  onFocusInput?: () => void;
}

export function useGlobalSearchHotkey(options: UseGlobalSearchHotkeyOptions) {
  return useGlobalHotkey({
    onKeyDown: (e: KeyboardEvent) => {
      // ESC key to clear search when not focused
      const shouldClear = options.shouldClear?.() ?? true;
      if (e.key === 'Escape' && shouldClear) {
        options.onClearSearch();
        return true;
      }

      // Check if the key is a letter (a-z) or digit (0-9)
      if (
        e.key.length === 1 &&
        /[a-zA-Z0-9]/.test(e.key) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        options.onSearchStart(e.key);
        options.onFocusInput?.();
        return true;
      }
      
      return false;
    },
    isEnabled: options.isEnabled,
  });
}
