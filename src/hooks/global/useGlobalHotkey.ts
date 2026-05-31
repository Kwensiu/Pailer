import { createEffect, onCleanup } from 'solid-js';
import { createTauriSignal } from '../storage/createTauriSignal';

// Global hotkey setting
const [isGlobalHotkeyEnabled] = createTauriSignal<boolean>('globalHotkeyEnabled', true);

interface UseGlobalHotkeyOptions {
  isEnabled?: () => boolean;
  onKeyDown: (e: KeyboardEvent) => boolean | void;
  shouldHandle?: (e: KeyboardEvent) => boolean;
}

export function useGlobalHotkey(options: UseGlobalHotkeyOptions) {
  createEffect(() => {
    const enabled = options.isEnabled?.() ?? isGlobalHotkeyEnabled();
    if (!enabled) {
      return;
    }

    const handleGlobalKeydown = (e: KeyboardEvent) => {
      // For Tab key, never handle it when focused on interactive elements
      if (e.key === 'Tab') {
        const activeElement = document.activeElement;
        if (
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.tagName === 'BUTTON' ||
          activeElement?.getAttribute('role') === 'menuitem' ||
          activeElement?.getAttribute('role') === 'menu' ||
          activeElement?.closest('[role="menu"]') ||
          activeElement?.closest('[data-contextmenu-root="true"]')
        ) {
          return; // Let Tab work normally in menus and on buttons
        }
      }

      // Default check: only handle when not already focused on input, menu, or button
      const shouldHandle =
        options.shouldHandle ??
        (() =>
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA' &&
          document.activeElement?.tagName !== 'BUTTON' &&
          document.activeElement?.getAttribute('role') !== 'menuitem');

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
  shouldClear: () => boolean;
  onSearchStart: (char: string) => void;
  onClearSearch: () => void;
  onFocusInput: () => void;
}

export function useGlobalSearchHotkey(options: UseGlobalSearchHotkeyOptions) {
  createEffect(() => {
    if (!isGlobalHotkeyEnabled()) {
      return;
    }

    const handleGlobalKeydown = (e: KeyboardEvent) => {
      // For Tab key, never handle it when focused on interactive elements
      if (e.key === 'Tab') {
        const activeElement = document.activeElement;
        if (
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.tagName === 'BUTTON' ||
          activeElement?.getAttribute('role') === 'menuitem' ||
          activeElement?.getAttribute('role') === 'menu' ||
          activeElement?.closest('[role="menu"]') ||
          activeElement?.closest('[data-contextmenu-root="true"]')
        ) {
          return; // Let Tab work normally in menus and on buttons
        }
      }

      // Only handle when not already focused on input, menu, or button
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'BUTTON' ||
        document.activeElement?.getAttribute('role') === 'menuitem'
      ) {
        return;
      }

      // ESC key to clear search when not focused
      if (e.key === 'Escape' && options.shouldClear()) {
        e.preventDefault();
        options.onClearSearch();
        return;
      }

      // Check if the key is a letter (a-z), digit (0-9), or forward slash (/)
      if (
        e.key.length === 1 &&
        /[a-zA-Z0-9/]/.test(e.key) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();

        // Special handling for forward slash when input is empty
        if (e.key === '/' && !options.shouldClear()) {
          options.onFocusInput();
          return;
        }

        // For other keys, start search (character accumulation handled by component)
        options.onSearchStart(e.key);
        options.onFocusInput();
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    onCleanup(() => {
      document.removeEventListener('keydown', handleGlobalKeydown);
    });
  });
}
