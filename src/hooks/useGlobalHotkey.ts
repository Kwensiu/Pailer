import { createEffect, onCleanup } from 'solid-js';
import { createTauriSignal } from './createTauriSignal';

// Global hotkey setting
const [isGlobalHotkeyEnabled] = createTauriSignal<boolean>('globalHotkeyEnabled', true);

// Search format parsing
export interface ParsedSearch {
  appName: string;
  bucketName?: string;
  forceAppMatch: boolean;
  forceBucketMatch: boolean;
}

/**
 * Parse search format: supports app_name/bucket and 'app_name'/'bucket' formats
 *
 * Supported formats:
 * - 7zip: normal search
 * - 7zip/ai: bucket-limited search (bucket name contains "ai")
 * - 7zip/: all buckets search (same as normal search)
 * - '7zip'/'ai': force exact match
 *
 * Notes:
 * - "/bucket" (without app name) will return empty results
 * - Does not support multiple slashes input, such as "app/bucket/extra"
 */
export function parseSearchFormat(input: string): ParsedSearch {
  const trimmed = input.trim();

  // Check if it contains quotes (force match format)
  const quoteMatch = trimmed.match(/^(['"])(.*?)\1\s*\/\s*(['"])(.*?)\3$/);
  if (quoteMatch) {
    return {
      appName: quoteMatch[2],
      bucketName: quoteMatch[4],
      forceAppMatch: true,
      forceBucketMatch: true,
    };
  }

  // Check if it contains / separator
  const slashIndex = trimmed.indexOf('/');
  if (slashIndex !== -1) {
    const appPart = trimmed.substring(0, slashIndex).trim();
    const bucketPart = trimmed.substring(slashIndex + 1).trim();

    return {
      appName: appPart,
      bucketName: bucketPart || undefined, // 空bucketPart表示所有仓库
      forceAppMatch: false,
      forceBucketMatch: false,
    };
  }

  // Normal search
  return {
    appName: trimmed,
    bucketName: undefined,
    forceAppMatch: false,
    forceBucketMatch: false,
  };
}

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
      // Default check: only handle when not already focused on input
      const shouldHandle =
        options.shouldHandle ??
        (() =>
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA');

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
      // Only handle when not already focused on input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
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
