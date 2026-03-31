import {
  Show,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { computePosition, flip, shift } from '@floating-ui/dom';
import { createMenuFocusManagement, clearTabbedState } from '../../../hooks/index';
import { ChevronRight } from 'lucide-solid';

export type ContextMenuPosition = { x: number; y: number };

const ROOT_SELECTOR = '[data-contextmenu-root="true"]';
const ALLOW_SELECTOR = '[data-contextmenu-allow="true"]';
const TABBED_ITEM_SELECTOR = '[role="menuitem"][data-tabbed]';

interface SubMenuManager {
  activeSubMenuId: Accessor<string | null>;
  isOpen: (id: string) => boolean;
  requestOpen: (id: string) => void;
  openNow: (id: string) => void;
  requestClose: () => void;
  cancelClose: () => void;
  closeAll: () => void;
}

const SubMenuContext = createContext<SubMenuManager>();

export const useSubMenuManager = () => useContext(SubMenuContext);

const isWithinSelector = (target: EventTarget | null, selector: string) => {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(selector));
};

export interface ContextMenuProps {
  isOpen: Accessor<boolean>;
  position: Accessor<ContextMenuPosition>;
  onClose: () => void;
  ariaLabel?: string;
  children: JSX.Element | ((context: { onClose: () => void }) => JSX.Element);
}

export default function ContextMenu(props: ContextMenuProps) {
  const close = () => props.onClose();
  let contentRef: HTMLDivElement | undefined;
  let rafId: number | undefined;
  let closeTimer: number | undefined;
  let openTimer: number | undefined;
  const [activeSubMenuId, setActiveSubMenuId] = createSignal<string | null>(null);
  const [pendingOpenId, setPendingOpenId] = createSignal<string | null>(null);

  const { handleKeyNav } = createMenuFocusManagement(() => contentRef);

  const clearOpenTimer = () => {
    if (openTimer !== undefined) {
      window.clearTimeout(openTimer);
      openTimer = undefined;
    }
  };

  const clearCloseTimer = () => {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  };

  const closeAll = () => {
    clearOpenTimer();
    clearCloseTimer();
    setPendingOpenId(null);
    setActiveSubMenuId(null);
  };

  const openNow = (id: string) => {
    clearOpenTimer();
    clearCloseTimer();
    setPendingOpenId(null);
    setActiveSubMenuId(id);
  };

  const requestOpen = (id: string) => {
    clearCloseTimer();

    if (activeSubMenuId() === id) {
      clearOpenTimer();
      setPendingOpenId(null);
      return;
    }

    if (pendingOpenId() === id && openTimer !== undefined) return;

    clearOpenTimer();
    setPendingOpenId(id);
    const capturedId = id;
    openTimer = window.setTimeout(() => {
      if (pendingOpenId() === capturedId) {
        setActiveSubMenuId(capturedId);
      }
      setPendingOpenId(null);
      openTimer = undefined;
    }, 300);
  };

  const requestClose = () => {
    clearOpenTimer();
    setPendingOpenId(null);

    if (activeSubMenuId() === null) return;

    clearCloseTimer();
    closeTimer = window.setTimeout(() => {
      setActiveSubMenuId(null);
      closeTimer = undefined;
    }, 300);
  };

  onCleanup(() => {
    if (rafId !== undefined) {
      window.cancelAnimationFrame(rafId);
      rafId = undefined;
    }
    clearCloseTimer();
    clearOpenTimer();
  });

  const updatePosition = async () => {
    if (!contentRef) return;

    const position = props.position();
    const virtualReference = {
      getBoundingClientRect: () => ({
        x: position.x,
        y: position.y,
        left: position.x,
        top: position.y,
        right: position.x,
        bottom: position.y,
        width: 0,
        height: 0,
      }),
    };

    const { x, y } = await computePosition(virtualReference, contentRef, {
      placement: 'right-start',
      strategy: 'fixed',
      middleware: [flip({ padding: 8 }), shift({ padding: 8 })],
    });

    contentRef.style.left = `${x}px`;
    contentRef.style.top = `${y}px`;
  };

  createEffect(() => {
    if (props.isOpen()) {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        updatePosition();
        const items = Array.from(
          contentRef?.querySelectorAll('[role="menuitem"]:not([disabled])') ?? []
        ) as HTMLElement[];
        if (items.length > 0) {
          items[0].focus();
        }
      });
    } else {
      closeAll();
      clearTabbedState(contentRef, TABBED_ITEM_SELECTOR);
    }
  });

  createEffect(() => {
    if (!props.isOpen()) return;

    const handleInteractionOutside = (e: PointerEvent | MouseEvent) => {
      if (isWithinSelector(e.target, ROOT_SELECTOR)) return;
      if (isWithinSelector(e.target, ALLOW_SELECTOR)) {
        close();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    const handleScroll = () => close();
    const handleWindowBlur = () => close();
    const handleVisChange = () => {
      if (document.hidden) close();
    };

    document.addEventListener('pointerdown', handleInteractionOutside, true);
    document.addEventListener('contextmenu', handleInteractionOutside, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisChange);
    document.body.classList.add('contextmenu-open');

    onCleanup(() => {
      document.removeEventListener('pointerdown', handleInteractionOutside, true);
      document.removeEventListener('contextmenu', handleInteractionOutside, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisChange);
      document.body.classList.remove('contextmenu-open');
    });
  });

  return (
    <Show when={props.isOpen()}>
      <Portal>
        <div class="pointer-events-none fixed inset-0 z-9998">
          <SubMenuContext.Provider
            value={{
              activeSubMenuId,
              isOpen: (id) => activeSubMenuId() === id,
              requestOpen,
              openNow,
              requestClose,
              cancelClose: clearCloseTimer,
              closeAll,
            }}
          >
            <div
              ref={contentRef}
              data-contextmenu-root="true"
              class="bg-base-100/60 rounded-box border-base-200 pointer-events-auto fixed z-9999 min-w-[150px] border py-2 shadow-lg backdrop-blur-md"
              role="menu"
              aria-label={props.ariaLabel || 'Context menu'}
              aria-orientation="vertical"
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  handleKeyNav(e);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  close();
                }
              }}
            >
              {typeof props.children === 'function'
                ? props.children({ onClose: close })
                : props.children}
            </div>
          </SubMenuContext.Provider>
        </div>
      </Portal>
    </Show>
  );
}

export interface MenuItemProps {
  onSelect: () => void;
  disabled?: boolean;
  class?: string;
  children: JSX.Element;
  closeOnSelect?: boolean;
  onClose?: () => void;
  onMouseEnter?: () => void;
}

export function MenuItem(props: MenuItemProps) {
  const classes = [
    'hover:bg-base-200 flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2 text-left text-sm',
    props.class || '',
    props.disabled ? 'cursor-not-allowed opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      class={classes}
      onMouseEnter={props.onMouseEnter}
      onClick={() => {
        if (!props.disabled) {
          props.onSelect();
          if (props.closeOnSelect !== false) {
            props.onClose?.();
          }
        }
      }}
      disabled={props.disabled}
      role="menuitem"
      aria-disabled={props.disabled ? 'true' : 'false'}
    >
      {props.children}
    </button>
  );
}

export interface SubMenuProps {
  trigger: JSX.Element;
  children: JSX.Element;
}

export function SubMenu(props: SubMenuProps) {
  const subMenuManager = useContext(SubMenuContext);
  const subMenuId = createUniqueId();
  // Use local state as fallback when no context (e.g., in Dropdown)
  const [localIsOpen, setLocalIsOpen] = createSignal(false);
  const isOpen = createMemo(() => subMenuManager?.isOpen(subMenuId) ?? localIsOpen());
  const [showOnLeft, setShowOnLeft] = createSignal(false);
  let triggerRef: HTMLDivElement | undefined;
  let submenuRef: HTMLDivElement | undefined;

  // Calculate position when submenu opens to avoid layout thrashing
  createEffect(() => {
    if (isOpen() && triggerRef) {
      const rect = triggerRef.getBoundingClientRect();
      setShowOnLeft(rect.right + 150 >= window.innerWidth);
    }
  });

  const openSubMenu = () => {
    if (isOpen()) {
      subMenuManager?.cancelClose();
      return;
    }
    if (subMenuManager) {
      subMenuManager.requestOpen(subMenuId);
    } else {
      setLocalIsOpen(true);
    }
  };

  const openSubMenuImmediately = () => {
    if (isOpen()) return;
    if (subMenuManager) {
      subMenuManager.openNow(subMenuId);
    } else {
      setLocalIsOpen(true);
    }
  };

  const closeSubMenu = () => {
    if (subMenuManager) {
      subMenuManager.requestClose();
    } else {
      setLocalIsOpen(false);
    }
  };

  const focusFirstSubItem = () => {
    const first = submenuRef?.querySelector('[role="menuitem"]:not([disabled])') as
      | HTMLElement
      | undefined;
    first?.focus();
  };

  const handleSubMenuKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'Escape') {
      e.preventDefault();
      subMenuManager?.closeAll();
      triggerRef?.focus();
    }
  };

  return (
    <div class="group relative" onMouseEnter={openSubMenu} onMouseLeave={closeSubMenu}>
      <div
        ref={triggerRef}
        class="hover:bg-base-200 flex cursor-pointer items-center gap-2 px-4 py-2 text-sm"
        role="menuitem"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={isOpen()}
        onClick={() => {
          if (isOpen()) return;
          openSubMenuImmediately();
          requestAnimationFrame(focusFirstSubItem);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isOpen()) return;
            openSubMenuImmediately();
            requestAnimationFrame(focusFirstSubItem);
          } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
            e.preventDefault();
            subMenuManager?.closeAll();
            triggerRef?.focus();
          }
        }}
      >
        {props.trigger}
        <ChevronRight class="ml-auto size-4" />
      </div>
      <Show when={isOpen()}>
        <div
          ref={submenuRef}
          class="bg-base-100 rounded-box border-base-200 absolute -top-2 -ml-2 border py-2 whitespace-pre shadow-lg"
          classList={{
            'left-full': !showOnLeft(),
            'right-full': showOnLeft(),
          }}
          role="menu"
          tabIndex={-1}
          onKeyDown={handleSubMenuKeyDown}
        >
          {props.children}
        </div>
      </Show>
    </div>
  );
}

export function Separator() {
  return <div class="border-base-200 my-1 border-t" />;
}
