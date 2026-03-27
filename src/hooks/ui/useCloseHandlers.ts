import { onCleanup } from 'solid-js';
import { clearTabbedState } from './useTabNav';

export interface MenuCloseHandlers {
  close: () => void;
  contentRef?: () => HTMLDivElement | undefined;
  menuRootSelector?: string;
  tabbedSelector?: string;
  enableScrollClose?: boolean;
  enableWindowBlur?: boolean;
  enableVisibilityChange?: boolean;
  enableBodyClass?: boolean;
}

/**
 * Creates unified menu close event handlers
 * Handles click-outside, ESC key, scroll, window blur, and other close events
 */
export function createMenuCloseHandlers(options: MenuCloseHandlers) {
  const {
    close,
    contentRef,
    menuRootSelector = '[data-context-menu-root="true"]',
    tabbedSelector = '[role="menuitem"][data-tabbed]',
    enableScrollClose = true,
    enableWindowBlur = true,
    enableVisibilityChange = true,
    enableBodyClass = true,
  } = options;

  const handlePointerDown = (e: Event) => {
    const target = e.target as Element;
    if (!target.closest(menuRootSelector)) {
      close();
    }
  };

  const handleKeyDown = (e: Event) => {
    if ((e as KeyboardEvent).key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const handleScroll = () => close();
  const handleWindowBlur = () => close();
  const handleVisChange = () => {
    if (document.hidden) close();
  };

  return (isOpen: boolean) => {
    if (isOpen) {
      const events: Array<[string, EventListener, boolean?]> = [
        ['pointerdown', handlePointerDown, true],
        ['keydown', handleKeyDown, true],
      ];

      if (enableScrollClose) {
        events.push(['scroll', handleScroll, true]);
      }
      if (enableWindowBlur) {
        events.push(['blur', handleWindowBlur]);
      }
      if (enableVisibilityChange) {
        events.push(['visibilitychange', handleVisChange]);
      }

      events.forEach(([event, handler, capture]) => {
        const target = event === 'blur' ? window : document;
        target.addEventListener(event, handler, capture);
      });

      if (enableBodyClass) {
        document.body.classList.add('context-menu-open');
      }

      onCleanup(() => {
        events.forEach(([event, handler, capture]) => {
          const target = event === 'blur' ? window : document;
          target.removeEventListener(event, handler, capture);
        });

        if (enableBodyClass) {
          document.body.classList.remove('context-menu-open');
        }

        if (contentRef) {
          clearTabbedState(contentRef(), tabbedSelector);
        }
      });
    }
  };
}
